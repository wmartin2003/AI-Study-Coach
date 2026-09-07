import { Router, type IRouter } from "express";
import { JoinWaitlistBody, JoinWaitlistResponse } from "@workspace/api-zod";
import { supabaseAdmin } from "../lib/supabase";
import { createIpRateLimit } from "../middlewares/rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const waitlistRateLimit = createIpRateLimit({
  windowMs: 60_000,
  maxRequests: 5,
  message: "Too many attempts. Please wait a moment and try again.",
});

router.post("/waitlist", waitlistRateLimit, async (req, res) => {
  const input = JoinWaitlistBody.parse(req.body);
  const email = input.email.trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Enter an email address." });

  // waitlist has a unique constraint on email and grants no policies to any
  // role but the service role — writing twice with the same email is a
  // harmless no-op, not an error the visitor needs to see.
  const { error } = await supabaseAdmin.from("waitlist").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    logger.error({ err: error }, "Waitlist signup failed");
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }

  return res.status(201).json(JoinWaitlistResponse.parse({ ok: true }));
});

export default router;
