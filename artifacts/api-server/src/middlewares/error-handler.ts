import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";
import { QuotaExceededError, ServicePausedError } from "../lib/usage";

type ZodIssueLike = { path: (string | number)[]; message: string };

function isZodError(err: unknown): err is { name: "ZodError"; issues: ZodIssueLike[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

function isMulterError(err: unknown): err is { name: "MulterError"; code: string } {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "MulterError";
}

const MULTER_ERROR_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: "That file is too large. Please upload something under 20 MB.",
  LIMIT_UNEXPECTED_FILE: "That upload wasn't in the format we expected. Please try again.",
};

/**
 * Registered after all routes. Express 5 forwards both sync throws and
 * rejected promises from async handlers here automatically, so this is the
 * only place request-validation and unexpected errors need to be turned into
 * safe responses — never a raw stack trace or file path to the client.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Named error classes, not string matching, so these can never be
  // confused with an unrelated error that happens to share a message.
  if (err instanceof QuotaExceededError) {
    res.status(429).json({ error: err.message });
    return;
  }

  if (err instanceof ServicePausedError) {
    res.status(503).json({ error: err.message });
    return;
  }

  if (isZodError(err)) {
    res.status(400).json({
      error: "Invalid request",
      details: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  if (isMulterError(err)) {
    res.status(413).json({ error: MULTER_ERROR_MESSAGES[err.code] ?? "That upload couldn't be processed. Please try again." });
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
