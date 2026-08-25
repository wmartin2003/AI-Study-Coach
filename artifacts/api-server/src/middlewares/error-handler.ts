import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

type ZodIssueLike = { path: (string | number)[]; message: string };

function isZodError(err: unknown): err is { name: "ZodError"; issues: ZodIssueLike[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

/**
 * Registered after all routes. Express 5 forwards both sync throws and
 * rejected promises from async handlers here automatically, so this is the
 * only place request-validation and unexpected errors need to be turned into
 * safe responses — never a raw stack trace or file path to the client.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (isZodError(err)) {
    res.status(400).json({
      error: "Invalid request",
      details: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  logger.error({ err, url: req.originalUrl, method: req.method }, "Unhandled request error");

  // body-parser (and similar middleware) set a sensible `.status` on the
  // error it throws (e.g. 400 for malformed JSON) — honor that status code
  // without ever forwarding the underlying message or stack to the client.
  const status = isHttpError(err) ? err.status : 500;
  const message = status === 400 ? "That request couldn't be understood." : "Something went wrong on our end. Please try again.";
  res.status(status).json({ error: message });
}

function isHttpError(err: unknown): err is { status: number } {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}
