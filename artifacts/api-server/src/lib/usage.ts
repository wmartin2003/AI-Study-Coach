import { logger } from "./logger";
import { supabaseAdmin } from "./supabase";

export type AiFeature = "tutor" | "quiz" | "study_guide" | "syllabus" | "topics";

/**
 * Dollars per million tokens, by model id.
 *
 * Rates taken from https://claude.com/pricing on 2026-09-07. Pricing can
 * change — re-verify against that page before trusting these for a real
 * bill, and update this comment's date whenever you do.
 */
export const MODEL_RATES: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-sonnet-5": { inputPerMillion: 3, outputPerMillion: 15 },
};

const DEFAULT_RATE = { inputPerMillion: 3, outputPerMillion: 15 };

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_RATES[model];
  if (!rate) {
    // Silently under- (or over-) reporting real spend is the failure mode
    // that matters here — a missing rate should be loud, not invisible.
    logger.warn({ model }, "No pricing entry for this model; falling back to the default rate. Add it to MODEL_RATES.");
  }
  const effectiveRate = rate ?? DEFAULT_RATE;
  return (inputTokens / 1_000_000) * effectiveRate.inputPerMillion + (outputTokens / 1_000_000) * effectiveRate.outputPerMillion;
}

export class QuotaExceededError extends Error {
  constructor(message = "You've used this month's AI allowance. It resets on the 1st — your courses, notes and progress are all still here.") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export class ServicePausedError extends Error {
  constructor(message = "AI features are paused right now. Everything you've saved is safe — try again tomorrow.") {
    super(message);
    this.name = "ServicePausedError";
  }
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Checked before every Anthropic call, never after. Throws ServicePausedError
 * when the service-wide kill switch is on or the whole app has spent past its
 * monthly ceiling this calendar month; throws QuotaExceededError when this
 * particular user has spent past their own cap. All reads use supabaseAdmin
 * — ai_usage and ai_service_state grant no access to the anon/authenticated
 * roles, so a user-scoped client couldn't read them even if we wanted it to.
 */
export async function assertBudgetAvailable(userId: string): Promise<void> {
  const { data: state, error: stateError } = await supabaseAdmin
    .from("ai_service_state")
    .select("paused, paused_reason, monthly_budget_usd")
    .eq("id", 1)
    .maybeSingle();
  if (stateError) throw stateError;

  if (state?.paused) {
    throw new ServicePausedError();
  }

  const since = monthStartIso();

  const { data: globalRows, error: globalError } = await supabaseAdmin
    .from("ai_usage")
    .select("estimated_cost_usd")
    .gte("occurred_at", since);
  if (globalError) throw globalError;

  const globalSpend = (globalRows ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);
  const globalBudget = Number(state?.monthly_budget_usd ?? 40);
  if (globalSpend >= globalBudget) {
    throw new ServicePausedError();
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("monthly_budget_usd")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;

  const defaultUserBudget = Number(process.env["USER_MONTHLY_BUDGET_USD"] ?? 2);
  const userBudget = profile?.monthly_budget_usd != null ? Number(profile.monthly_budget_usd) : defaultUserBudget;

  const { data: userRows, error: userError } = await supabaseAdmin
    .from("ai_usage")
    .select("estimated_cost_usd")
    .eq("user_id", userId)
    .gte("occurred_at", since);
  if (userError) throw userError;

  const userSpend = (userRows ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);
  if (userSpend >= userBudget) {
    throw new QuotaExceededError();
  }
}

/**
 * Recorded only after a real Anthropic call returned, using its actual
 * response.usage — never an estimate substituting for a call that didn't
 * happen. Written via supabaseAdmin since ai_usage grants no insert policy
 * to any other role.
 */
export async function recordUsage(options: {
  userId: string;
  feature: AiFeature;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}): Promise<void> {
  const estimatedCostUsd = estimateCostUsd(options.model, options.usage.inputTokens, options.usage.outputTokens);
  const { error } = await supabaseAdmin.from("ai_usage").insert({
    user_id: options.userId,
    feature: options.feature,
    model: options.model,
    input_tokens: options.usage.inputTokens,
    output_tokens: options.usage.outputTokens,
    estimated_cost_usd: estimatedCostUsd,
  });
  if (error) throw error;
}
