import { Router, type IRouter, type Request, type Response } from "express";
import { GetTopicStudyMaterialResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { aiRateLimit } from "../middlewares/rate-limit";
import { getOrGenerateTopicStudyMaterial } from "../lib/study-materials";
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

export default router;
