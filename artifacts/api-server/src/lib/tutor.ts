import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, TUTOR_MODEL } from "./anthropic";
import type { RetrievedChunk } from "./documents";

const SYSTEM_PROMPT = `ROLE: You are an adaptive educational tutor inside "AI Study Coach".

GOAL: Help the student understand and retain concepts — not just get an answer.

RULES:
- Teach rather than simply answer. Prefer guiding questions over immediate solutions.
- Ask a follow-up question when it would help the student think, but don't force a rigid structure onto every reply — stay conversational.
- Give hints before solutions. If a student asks you to solve their homework outright, offer a hint first and invite them to try before giving the full solution.
- Adapt your depth and vocabulary to the student's apparent level.
- Identify misconceptions gently and correct them clearly, without shaming the student.
- Use the student's learning history (mastery, recent mistakes) to tailor your response when it's relevant.
- Use the student's education level, year, and program to pitch depth and vocabulary appropriately — but never assume or invent specifics of their school's actual curriculum, syllabus, or course content unless it was provided to you directly.
- Ground answers in the student's uploaded material when it's provided in context; if nothing relevant was retrieved, say so plainly instead of guessing.
- Never claim to have read a document that wasn't provided to you.
- Keep replies concise — a few short paragraphs at most, plus at most one follow-up question or prompt.

You will be given structured context about the student before their message. Use it silently; don't recite it back to them.`;

export type TutorContext = {
  fullName: string | null;
  educationLevel: string | null;
  gradeYear: string | null;
  programMajor: string | null;
  courseId: string | null;
  courseName: string | null;
  topicName: string | null;
  masteryLevel: string | null;
  masteryScore: number | null;
  recentMistakes: string[];
};

export type TutorTurn = { role: "user" | "assistant"; content: string };

/**
 * Builds the tutor's context from real, explicit identifiers (a course id
 * the student picked, a topic name within it) rather than parsing a free-text
 * label — the previous approach broke silently whenever a course name
 * contained the separator or didn't match exactly.
 */
export async function assembleContext(
  supabase: SupabaseClient,
  userId: string,
  courseId: string | null | undefined,
  topicName: string | null | undefined,
): Promise<TutorContext> {
  const [profileRes, courseRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, education_level, grade_year, program_major")
      .eq("id", userId)
      .maybeSingle(),
    courseId
      ? supabase.from("courses").select("id, name").eq("id", courseId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let resolvedTopicName: string | null = topicName ?? null;
  let masteryLevel: string | null = null;
  let masteryScore: number | null = null;

  if (courseRes.data && topicName) {
    const { data: topic } = await supabase
      .from("topics")
      .select("name, mastery_level, mastery_score")
      .eq("course_id", courseRes.data.id)
      .ilike("name", topicName)
      .maybeSingle();

    if (topic) {
      resolvedTopicName = topic.name;
      masteryLevel = topic.mastery_level;
      masteryScore = Number(topic.mastery_score);
    }
  }

  const { data: mistakes } = await supabase
    .from("mistakes")
    .select("question_text")
    .eq("user_id", userId)
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(3);

  return {
    fullName: profileRes.data?.full_name ?? null,
    educationLevel: profileRes.data?.education_level ?? null,
    gradeYear: profileRes.data?.grade_year ?? null,
    programMajor: profileRes.data?.program_major ?? null,
    courseId: courseRes.data?.id ?? null,
    courseName: courseRes.data?.name ?? null,
    topicName: resolvedTopicName,
    masteryLevel,
    masteryScore,
    recentMistakes: (mistakes ?? []).map((m) => m.question_text),
  };
}

function contextBlock(context: TutorContext, retrieval?: { hasDocuments: boolean; chunks: RetrievedChunk[] }): string {
  const lines = [
    context.fullName ? `Student: ${context.fullName}` : null,
    context.educationLevel ? `Education level: ${context.educationLevel}${context.gradeYear ? ` (${context.gradeYear})` : ""}` : null,
    context.programMajor ? `Program/major: ${context.programMajor}` : null,
    context.courseName ? `Course: ${context.courseName}` : null,
    context.topicName ? `Current topic: ${context.topicName}` : null,
    context.masteryLevel
      ? `Mastery on this topic: ${context.masteryLevel} (${Math.round(context.masteryScore ?? 0)}%)`
      : null,
    context.recentMistakes.length
      ? `Recent unresolved mistakes:\n${context.recentMistakes.map((m) => `- ${m}`).join("\n")}`
      : null,
  ].filter(Boolean);

  const base = lines.length ? `[Student context]\n${lines.join("\n")}` : "";

  if (!retrieval?.hasDocuments) return base;

  const docBlock = retrieval.chunks.length
    ? `[Retrieved from the student's uploaded material — ground your answer in this when it's relevant, and mention which file it's from]\n${retrieval.chunks
        .map((c) => `From "${c.fileName}":\n${c.content}`)
        .join("\n\n")}`
    : `[The student has uploaded material for this course, but nothing relevant to their message was found in it. If their question seems to be about that material, say plainly you couldn't find it there rather than guessing.]`;

  return [base, docBlock].filter(Boolean).join("\n\n");
}

export async function generateReply(
  context: TutorContext,
  history: TutorTurn[],
  message: string,
  retrieval?: { hasDocuments: boolean; chunks: RetrievedChunk[] },
): Promise<{ message: string; prompt: string }> {
  const block = contextBlock(context, retrieval);

  const response = await anthropic.messages.create({
    model: TUTOR_MODEL,
    max_tokens: 700,
    system: block ? `${SYSTEM_PROMPT}\n\n${block}` : SYSTEM_PROMPT,
    messages: [
      ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
      { role: "user" as const, content: message },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  // Split a trailing question into a distinct "prompt" for the UI's follow-up
  // affordance; if there's no clear trailing question, leave it blank.
  const sentences = text.split(/(?<=[.?!])\s+/);
  const last = sentences[sentences.length - 1] ?? "";
  const hasTrailingQuestion = last.trim().endsWith("?") && sentences.length > 1;

  return {
    message: text,
    prompt: hasTrailingQuestion ? last.trim() : "",
  };
}
