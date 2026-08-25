import { Router, type IRouter } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth";
import { processDocument } from "../lib/documents";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post("/documents", upload.single("file"), async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "No file provided" });

  const courseId = typeof req.body.courseId === "string" && req.body.courseId ? req.body.courseId : null;
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
      status: "processing",
    })
    .select("id, file_name")
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  const result = await processDocument(supabase, doc.id);

  return res.status(201).json({ id: doc.id, fileName: doc.file_name, status: result.status });
});

export default router;
