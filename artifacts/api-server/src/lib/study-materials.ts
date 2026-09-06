import type { SupabaseClient } from "@supabase/supabase-js";
import { generateStructured } from "./anthropic";
import { retrieveRelevantChunks } from "./documents";

export type TopicKeyTerm = { term: string; definition: string };
export type TopicMaterialSource = { fileName: string; chunkCount: number };
export type TopicStudyMaterial = {
  topicName: string;
  summary: string;
  keyPoints: string[];
  keyTerms: TopicKeyTerm[];
  nextStep: string;
  // True only when at least one of the student's own uploaded-document
  // chunks actually contributed to this guide — the UI uses this to be
  // honest about "from your materials" vs. "general knowledge" rather than
  // ever implying the AI has read something it hasn't.
  groundedInMaterials: boolean;
  sources: TopicMaterialSource[];
  generatedAt: string;
};

type GeneratedGuide = {
  summary: string;
  keyPoints: string[];
  keyTerms: TopicKeyTerm[];
  nextStep: string;
};

async function generateGuide(
  courseName: string,
  topicName: string,
  level: string,
  chunks: { content: string; fileName: string }[],
): Promise<GeneratedGuide> {
  const hasMaterial = chunks.length > 0;
  const materialBlock = hasMaterial
    ? chunks.map((c) => `From "${c.fileName}":\n${c.content}`).join("\n\n")
    : "";

  return generateStructured<GeneratedGuide>({
    system: [
      "You write concise, well-organized study guides for a study-coach app.",
      hasMaterial
        ? "Base the guide primarily on the student's own uploaded material given below. Paraphrase and cite its actual content rather than generic textbook facts, and don't introduce claims that go beyond it or well-established general knowledge."
        : "The student hasn't uploaded material for this topic yet, so write a solid general-knowledge study guide instead. Never imply it came from their own notes.",
      "Keep the summary to 2-4 sentences. Give 4-7 key points as short, standalone statements someone could scan in a few seconds — not sentence fragments. Give 3-8 key terms, only ones that actually matter for this topic, each with a one-sentence definition. The next step should be one concrete, specific, encouraging suggestion for what to do next.",
    ].join("\n"),
    prompt: [
      `Course: ${courseName}`,
      `Topic: ${topicName}`,
      `Student level: ${level}`,
      materialBlock ? `\n[Student's uploaded material relevant to this topic]\n${materialBlock}` : "",
    ].join("\n"),
    toolName: "write_study_guide",
    toolDescription: "Return a structured study guide for one topic.",
    maxTokens: 2048,
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        keyPoints: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
        keyTerms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              term: { type: "string" },
              definition: { type: "string" },
            },
            required: ["term", "definition"],
          },
          minItems: 1,
          maxItems: 8,
        },
        nextStep: { type: "string" },
      },
      required: ["summary", "keyPoints", "keyTerms", "nextStep"],
    },
  });
}

function toResponse(topicName: string, row: Record<string, any>): TopicStudyMaterial {
  return {
    topicName,
    summary: row["summary"],
    keyPoints: (row["key_points"] as string[]) ?? [],
    keyTerms: (row["key_terms"] as TopicKeyTerm[]) ?? [],
    nextStep: row["next_step"] ?? "",
    groundedInMaterials: Boolean(row["grounded_in_materials"]),
    sources: (row["sources"] as TopicMaterialSource[]) ?? [],
    generatedAt: row["generated_at"],
  };
}

/**
 * Returns the cached study guide for a topic when it's still fresh, or
 * (re)generates it from the student's current uploaded material otherwise.
 * "Fresh" means the course's ready-document and chunk counts haven't changed
 * since the guide was last built — cheap to check, and it means a newly
 * uploaded (or removed) document is picked up the next time the student
 * opens the topic, without regenerating on every single view.
 */
export async function getOrGenerateTopicStudyMaterial(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  topicName: string,
  options: { force?: boolean } = {},
): Promise<TopicStudyMaterial | null> {
  const [{ data: course }, { data: topic }] = await Promise.all([
    supabase.from("courses").select("id, name, level").eq("id", courseId).eq("user_id", userId).maybeSingle(),
    supabase
      .from("topics")
      .select("id, name")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .ilike("name", topicName)
      .maybeSingle(),
  ]);
  if (!course || !topic) return null;

  const { data: readyDocs } = await supabase
    .from("documents")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .eq("status", "ready");
  const documentIds = (readyDocs ?? []).map((d) => d.id as string);

  let chunkCount = 0;
  if (documentIds.length) {
    const { count } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .in("document_id", documentIds);
    chunkCount = count ?? 0;
  }

  const { data: existing } = await supabase
    .from("topic_study_materials")
    .select("*")
    .eq("topic_id", topic.id)
    .maybeSingle();

  const isFresh =
    !!existing && existing.source_document_count === documentIds.length && existing.source_chunk_count === chunkCount;

  if (existing && isFresh && !options.force) {
    return toResponse(topic.name, existing);
  }

  const retrieval = await retrieveRelevantChunks(supabase, userId, courseId, `${topic.name} ${course.name}`, 8);
  const generated = await generateGuide(course.name, topic.name, course.level, retrieval.chunks);

  const sourceCounts = new Map<string, number>();
  for (const chunk of retrieval.chunks) sourceCounts.set(chunk.fileName, (sourceCounts.get(chunk.fileName) ?? 0) + 1);
  const sources: TopicMaterialSource[] = [...sourceCounts.entries()].map(([fileName, count]) => ({
    fileName,
    chunkCount: count,
  }));

  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    topic_id: topic.id,
    summary: generated.summary,
    key_points: generated.keyPoints,
    key_terms: generated.keyTerms,
    next_step: generated.nextStep,
    grounded_in_materials: retrieval.chunks.length > 0,
    sources,
    source_document_count: documentIds.length,
    source_chunk_count: chunkCount,
    generated_at: now,
    updated_at: now,
  };

  const { data: saved, error } = await supabase
    .from("topic_study_materials")
    .upsert(row, { onConflict: "topic_id" })
    .select("*")
    .single();
  if (error || !saved) throw error ?? new Error("Failed to save the generated study guide");

  return toResponse(topic.name, saved);
}
