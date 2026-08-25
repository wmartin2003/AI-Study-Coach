import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_CHUNK_CHARS = 1200;

function chunkText(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current.trim());
      current = "";
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;

    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars).trim());
      current = current.slice(maxChars);
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function extractText(fileName: string, mimeType: string | null, buffer: Buffer): Promise<string> {
  const lowerName = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const { default: pdfParse } = await import("pdf-parse");
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType?.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type for extraction: ${fileName}`);
}

/**
 * Downloads a just-uploaded document from Storage, extracts its text, chunks
 * it, and marks the document ready/failed. Runs inline on the upload request
 * rather than as a background job, so the client's response always reflects
 * the real outcome instead of a status that might silently never update.
 */
export async function processDocument(
  supabase: SupabaseClient,
  documentId: string,
): Promise<{ status: "ready" | "failed"; chunkCount?: number }> {
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, user_id, file_name, storage_path, mime_type")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) throw fetchError ?? new Error("Document not found");

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from("study-documents")
      .download(doc.storage_path);
    if (downloadError || !file) throw downloadError ?? new Error("Download failed");

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = (await extractText(doc.file_name, doc.mime_type, buffer)).trim();

    if (!text) throw new Error("No extractable text found");

    const chunks = chunkText(text);
    const { error: insertError } = await supabase.from("document_chunks").insert(
      chunks.map((content, index) => ({
        user_id: doc.user_id,
        document_id: documentId,
        chunk_index: index,
        content,
      })),
    );
    if (insertError) throw insertError;

    await supabase.from("documents").update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", documentId);
    return { status: "ready", chunkCount: chunks.length };
  } catch {
    await supabase.from("documents").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", documentId);
    return { status: "failed" };
  }
}

function scoreChunk(queryWords: Set<string>, content: string): number {
  const words = content.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  let hits = 0;
  for (const word of words) if (queryWords.has(word)) hits++;
  return hits;
}

export type RetrievedChunk = { content: string; fileName: string };

/**
 * Keyword-overlap retrieval over the student's own ready document chunks —
 * intentionally not a full document dump, per the "don't send the entire
 * document every time" instruction. Falls back to no course filter so
 * material uploaded without picking a course is still searchable.
 */
export async function retrieveRelevantChunks(
  supabase: SupabaseClient,
  userId: string,
  courseId: string | null,
  query: string,
  limit = 3,
): Promise<{ hasDocuments: boolean; chunks: RetrievedChunk[] }> {
  let docsQuery = supabase
    .from("documents")
    .select("id, file_name, course_id")
    .eq("user_id", userId)
    .eq("status", "ready");
  if (courseId) docsQuery = docsQuery.eq("course_id", courseId);

  const { data: docs } = await docsQuery;
  if (!docs || docs.length === 0) return { hasDocuments: false, chunks: [] };

  const { data: chunkRows } = await supabase
    .from("document_chunks")
    .select("content, document_id")
    .in(
      "document_id",
      docs.map((d) => d.id),
    );
  if (!chunkRows || chunkRows.length === 0) return { hasDocuments: true, chunks: [] };

  const queryWords = new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const fileNameById = new Map(docs.map((d) => [d.id, d.file_name] as const));

  const ranked = chunkRows
    .map((row) => ({ content: row.content, fileName: fileNameById.get(row.document_id) ?? "your notes", score: scoreChunk(queryWords, row.content) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { hasDocuments: true, chunks: ranked.map(({ content, fileName }) => ({ content, fileName })) };
}
