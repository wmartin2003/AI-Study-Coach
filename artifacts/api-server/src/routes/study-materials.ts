import { Router, type IRouter, type Request, type Response } from "express";
import { CompleteTopicStudyMaterialResponse, GetTopicStudyMaterialResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { aiRateLimit } from "../middlewares/rate-limit";
import { getOrGenerateTopicStudyMaterial, markTopicStudyMaterialComplete } from "../lib/study-materials";
import { QuotaExceededError, ServicePausedError } from "../lib/usage";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAuth);

async function respondWithStudyMaterial(req: Request, res: Response, force: boolean) {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const topicName = decodeURIComponent(String(req.params.topicName));

  try {
    const material = await getOrGenerateTopicStudyMaterial(supabase, userId, String(req.params.courseId), topicName, { force });
    if (!material) return res.status(404).json({ error: "Topic not found" });
    return res.json(GetTopicStudyMaterialResponse.parse(material));
  } catch (err) {
    if (err instanceof QuotaExceededError || err instanceof ServicePausedError) throw err;
    logger.error({ err, courseId: req.params.courseId, topicName }, "Study guide generation failed");
    return res.status(502).json({ error: "Couldn't build a study guide just now." });
  }
}

router.get("/courses/:courseId/topics/:topicName/study-material", aiRateLimit, (req, res) =>
  respondWithStudyMaterial(req, res, false),
);

router.post("/courses/:courseId/topics/:topicName/study-material/regenerate", aiRateLimit, (req, res) =>
  respondWithStudyMaterial(req, res, true),
);

router.post("/courses/:courseId/topics/:topicName/study-material/complete", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const topicName = decodeURIComponent(String(req.params.topicName));

  try {
    const result = await markTopicStudyMaterialComplete(supabase, userId, String(req.params.courseId), topicName);
    if (!result) return res.status(404).json({ error: "Study guide not found" });
    return res.json(CompleteTopicStudyMaterialResponse.parse(result));
  } catch (err) {
    logger.error({ err, courseId: req.params.courseId, topicName }, "Marking study guide done failed");
    return res.status(500).json({ error: "Couldn't save that just now." });
  }
});

export default router;
