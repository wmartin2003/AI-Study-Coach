import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAuth);

/**
 * Permanently deletes the signed-in student's account. Every user-owned
 * table has `on delete cascade` back to auth.users (supabase/migrations/
 * 0001_init.sql), so deleting the auth user is enough to remove every row
 * they own — the only thing that needs a separate step is Storage, which
 * cascade doesn't reach. Uses the admin client only for the operations that
 * genuinely require it (auth deletion, storage cleanup across the whole
 * bucket) — the initial read of what to delete still goes through the
 * caller's own RLS-scoped client, same as everywhere else in this app.
 */
router.delete("/account", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;

  const { data: docs, error: docsError } = await supabase.from("documents").select("storage_path");
  if (docsError) return res.status(500).json({ error: docsError.message });

  const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabaseAdmin.storage.from("study-documents").remove(paths);
    if (storageError) logger.error({ err: storageError, userId }, "Failed to remove some storage objects during account deletion");
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    logger.error({ err: deleteError, userId }, "Account deletion failed");
    return res.status(500).json({ error: "Couldn't delete your account just now. Please try again." });
  }

  return res.status(204).send();
});

export default router;
