import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient, supabaseAdmin } from "../lib/supabase";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string | null };
      supabase?: SupabaseClient;
    }
  }
}

/**
 * Verifies the caller's Supabase access token and attaches a request-scoped
 * Supabase client authenticated as that user, so downstream handlers never
 * need to (and never should) trust a client-supplied user id — every query
 * runs under that user's own RLS policies.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  req.user = { id: data.user.id, email: data.user.email ?? null };
  req.supabase = createUserClient(token);
  next();
}
