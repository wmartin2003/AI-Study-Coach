import Anthropic from "@anthropic-ai/sdk";
import { assertBudgetAvailable, recordUsage, type AiFeature } from "./usage";

const apiKey = process.env["ANTHROPIC_API_KEY"];
if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required but was not provided.");

// An explicit, bounded timeout so a slow/hung upstream call fails fast with
// our own friendly error message instead of leaving the user staring at a
// spinner for the SDK's much longer default timeout.
export const anthropic = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 2 });
export const TUTOR_MODEL = "claude-sonnet-5";

/**
 * Forces Claude to answer via a single tool call so the result is guaranteed
 * to match `inputSchema`, rather than parsing free-form text as JSON.
 *
 * Every caller must pass `userId`/`feature` — this function is the guard,
 * not just the SDK wrapper: it checks the caller's budget before spending a
 * cent, then records the real token usage from the response afterward. That
 * ordering (check → call → record) is deliberate: never estimate cost before
 * a call happens, and never record a call that didn't happen.
 */
export async function generateStructured<T>(options: {
  userId: string;
  feature: AiFeature;
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Anthropic.Tool["input_schema"];
  maxTokens?: number;
}): Promise<T> {
  await assertBudgetAvailable(options.userId);

  const response = await anthropic.messages.create({
    model: TUTOR_MODEL,
    max_tokens: options.maxTokens ?? 2048,
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
    tools: [
      {
        name: options.toolName,
        description: options.toolDescription,
        input_schema: options.inputSchema,
      },
    ],
    tool_choice: { type: "tool", name: options.toolName },
  });

  await recordUsage({
    userId: options.userId,
    feature: options.feature,
    model: TUTOR_MODEL,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured tool call.");
  }

  return toolUse.input as T;
}
