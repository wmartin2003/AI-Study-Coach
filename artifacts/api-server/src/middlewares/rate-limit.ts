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

/**
 * Same sliding-window shape as `aiRateLimit`, but keyed by IP and with its
 * own counter — for endpoints that run before there's a user to key on
 * (signup, waitlist). Each call to this factory gets an independent map and
 * window/limit, so a burst against one endpoint can't spend down another's
 * budget.
 */
export function createIpRateLimit(options: { windowMs: number; maxRequests: number; message: string }) {
  const ipHits = new Map<string, { count: number; resetAt: number }>();

  return function ipRateLimit(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = ipHits.get(key);

    if (!entry || entry.resetAt <= now) {
      ipHits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (entry.count >= options.maxRequests) {
      res.status(429).json({ error: options.message });
      return;
    }

    entry.count += 1;
    next();
  };
}
