import { Router, type IRouter } from "express";
import { ListAchievementsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/achievements", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;

  const { data, error } = await supabase
    .from("achievements")
    .select("id, key, title, description, earned_at, metadata, courses(name, course_code)")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    key: string;
    title: string;
    description: string | null;
    earned_at: string;
    metadata: { averageMastery?: number } | null;
    courses: { name: string; course_code: string | null } | null;
  }>;

  return res.json(
    ListAchievementsResponse.parse(
      rows.map((row) => ({
        id: row.id,
        key: row.key,
        title: row.title,
        description: row.description,
        courseName: row.courses?.name ?? null,
        courseCode: row.courses?.course_code ?? null,
        earnedAt: row.earned_at,
        masteryAtCompletion: row.metadata?.averageMastery ?? null,
      })),
    ),
  );
});

export default router;
