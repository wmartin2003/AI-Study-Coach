import { Router, type IRouter } from "express";
import { SearchInstitutionsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { searchInstitutions } from "../lib/institutions";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/institutions/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const countryCode = typeof req.query.countryCode === "string" ? req.query.countryCode : undefined;

  if (q.trim().length < 2) return res.json(SearchInstitutionsResponse.parse([]));

  try {
    const results = await searchInstitutions(q, countryCode);
    return res.json(SearchInstitutionsResponse.parse(results));
  } catch (err) {
    logger.error({ err }, "Institution search failed");
    return res.status(502).json({ error: "Couldn't search institutions just now. Try again in a moment." });
  }
});

export default router;
