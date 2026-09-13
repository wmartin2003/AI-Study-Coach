import { Router, type IRouter } from "express";
import { GetFeaturesResponse } from "@workspace/api-zod";
import { tutorEnabled } from "../lib/features";

const router: IRouter = Router();

/**
 * The frontend and API are deployed separately (Vercel and Render) — this
 * endpoint is the single source of truth for which features are on, the
 * same job GET /signup/config already does for signup, so the two hosts
 * can never disagree about it by each reading their own copy of an env var.
 */
router.get("/features", (_req, res) => {
  return res.json(GetFeaturesResponse.parse({ tutorEnabled: tutorEnabled() }));
});

export default router;
