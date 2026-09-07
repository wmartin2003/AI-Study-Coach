import { Router, type IRouter } from "express";
import multer from "multer";
import {
  ConfirmExtractionBody,
  ConfirmExtractionResponse,
  ExtractSyllabusResponse,
  GetDocumentUrlResponse,
  ListCourseDocumentsResponse,
  UpdateDocumentBody,
  UpdateDocumentResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { processDocument } from "../lib/documents";
import { extractSyllabusInfo } from "../lib/syllabus";
import { QuotaExceededError, ServicePausedError } from "../lib/usage";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const DOCUMENT_TYPES = new Set(["syllabus", "lecture", "notes", "study_guide", "other"]);

router.post("/documents", upload.single("file"), async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "No file provided" });

  const courseId = typeof req.body.courseId === "string" && req.body.courseId ? req.body.courseId : null;
  const documentType =
    typeof req.body.documentType === "string" && DOCUMENT_TYPES.has(req.body.documentType)
      ? req.body.documentType
      : "other";
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${courseId ?? "general"}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("study-documents")
    .upload(path, file.buffer, { contentType: file.mimetype });
  if (uploadError) {
    logger.error({ err: uploadError }, "Document upload to storage failed");
    return res.status(502).json({ error: "Couldn't upload that file just now." });
  }

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      course_id: courseId,
      file_name: file.originalname,
      storage_path: path,
      mime_type: file.mimetype,
      size_bytes: file.size,
      document_type: documentType,
      status: "processing",
    })
    .select("id, file_name")
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  const result = await processDocument(supabase, doc.id);

  return res.status(201).json({ id: doc.id, fileName: doc.file_name, status: result.status, documentType });
});

router.get("/courses/:courseId/documents", async (req, res) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("documents")
    .select("id, file_name, document_type, status, size_bytes, created_at")
    .eq("course_id", req.params.courseId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  return res.json(
    ListCourseDocumentsResponse.parse(
      (data ?? []).map((doc) => ({
        id: doc.id,
        fileName: doc.file_name,
        documentType: doc.document_type,
        status: doc.status,
        createdAt: doc.created_at,
        sizeBytes: doc.size_bytes,
      })),
    ),
  );
});

router.patch("/documents/:documentId", async (req, res) => {
  const supabase = req.supabase!;
  const input = UpdateDocumentBody.parse(req.body);
  if (input.fileName !== undefined && !input.fileName.trim()) {
    return res.status(400).json({ error: "File name can't be blank." });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.fileName !== undefined) patch["file_name"] = input.fileName.trim();
  if (input.documentType !== undefined) patch["document_type"] = input.documentType;

  const { data, error } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", req.params.documentId)
    .select("id, file_name, document_type, status, size_bytes, created_at")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Document not found" });

  return res.json(
    UpdateDocumentResponse.parse({
      id: data.id,
      fileName: data.file_name,
      documentType: data.document_type,
      status: data.status,
      createdAt: data.created_at,
      sizeBytes: data.size_bytes,
    }),
  );
});

router.delete("/documents/:documentId", async (req, res) => {
  const supabase = req.supabase!;
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", req.params.documentId)
    .maybeSingle();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  await supabase.storage.from("study-documents").remove([doc.storage_path]);
  const { error: deleteError } = await supabase.from("documents").delete().eq("id", req.params.documentId);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  return res.status(204).send();
});

router.get("/documents/:documentId/url", async (req, res) => {
  const supabase = req.supabase!;
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", req.params.documentId)
    .maybeSingle();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const { data, error } = await supabase.storage
    .from("study-documents")
    .createSignedUrl(doc.storage_path, 300);
  if (error || !data) return res.status(502).json({ error: "Couldn't create a download link just now." });

  return res.json(GetDocumentUrlResponse.parse({ url: data.signedUrl }));
});

router.post("/documents/:documentId/extract", async (req, res) => {
  const supabase = req.supabase!;
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", req.params.documentId)
    .maybeSingle();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  if (doc.status !== "ready") return res.status(409).json({ error: "This document hasn't finished processing yet." });

  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("content")
    .eq("document_id", doc.id)
    .order("chunk_index", { ascending: true });
  if (chunksError) return res.status(500).json({ error: chunksError.message });
  if (!chunks || chunks.length === 0) {
    return res.status(422).json({ error: "No extractable text was found in this document." });
  }

  try {
    const extraction = await extractSyllabusInfo(req.user!.id, chunks.map((c) => c.content).join("\n\n"));
    await supabase
      .from("documents")
      .update({ extraction, document_type: "syllabus", updated_at: new Date().toISOString() })
      .eq("id", doc.id);
    return res.json(ExtractSyllabusResponse.parse(extraction));
  } catch (err) {
    if (err instanceof QuotaExceededError || err instanceof ServicePausedError) throw err;
    logger.error({ err, documentId: doc.id }, "Syllabus extraction failed");
    return res.status(502).json({ error: "Couldn't read this document just now." });
  }
});

router.post("/documents/:documentId/confirm-extraction", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const input = ConfirmExtractionBody.parse(req.body);

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, course_id")
    .eq("id", req.params.documentId)
    .maybeSingle();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  if (!doc.course_id) return res.status(422).json({ error: "This document isn't attached to a course." });

  let topicsCreated = 0;
  if (input.topics.length) {
    const { data: existingTopics } = await supabase.from("topics").select("name, order_index").eq("course_id", doc.course_id);
    const existingNames = new Set((existingTopics ?? []).map((topic) => topic.name.trim().toLowerCase()));
    const baseIndex = (existingTopics ?? []).reduce((max, topic) => Math.max(max, topic.order_index), -1) + 1;
    const newTopics = input.topics.filter((topic) => !existingNames.has(topic.name.trim().toLowerCase()));
    if (newTopics.length) {
      const { error: topicsError } = await supabase.from("topics").insert(
        newTopics.map((topic, index) => ({
          user_id: userId,
          course_id: doc.course_id,
          name: topic.name,
          order_index: baseIndex + index,
        })),
      );
      if (!topicsError) topicsCreated = newTopics.length;
    }
  }

  let eventsCreated = 0;
  const datedEvents = input.events.filter((event) => event.eventDate);
  if (datedEvents.length) {
    const { data: existingEvents } = await supabase.from("course_events").select("title, event_date").eq("course_id", doc.course_id);
    const existingKeys = new Set((existingEvents ?? []).map((event) => `${event.title.trim().toLowerCase()}|${event.event_date}`));
    const newEvents = datedEvents.filter((event) => !existingKeys.has(`${event.title.trim().toLowerCase()}|${event.eventDate}`));
    if (newEvents.length) {
      const { error: eventsError } = await supabase.from("course_events").insert(
        newEvents.map((event) => ({
          user_id: userId,
          course_id: doc.course_id,
          type: event.type,
          title: event.title,
          event_date: event.eventDate,
          source: "syllabus",
        })),
      );
      if (!eventsError) eventsCreated = newEvents.length;
    }
  }

  await supabase
    .from("documents")
    .update({ extraction_confirmed: true, updated_at: new Date().toISOString() })
    .eq("id", doc.id);

  return res.json(ConfirmExtractionResponse.parse({ topicsCreated, eventsCreated }));
});

export default router;
