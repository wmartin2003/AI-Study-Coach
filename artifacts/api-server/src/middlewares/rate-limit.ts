import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple per-user sliding-window limiter for the AI-backed endpoints (tutor
 * messages, quiz generation) — cheap insurance against a runaway client
 * hammering the Anthropic API on this user's behalf.
 */
export function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.user?.id ?? req.ip ?? "anonymous";
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    res.status(429).json({ error: "Slow down a little — try again in a few seconds." });
    return;
  }

  entry.count += 1;
  next();
}
