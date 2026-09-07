import { ApiError } from "@workspace/api-client-react";

/**
 * Formats a "YYYY-MM-DD" date string for display. Deliberately does not use
 * `new Date(dateString)` directly — that parses as UTC midnight, which
 * renders as the previous day once `toLocaleDateString` applies the local
 * offset in any timezone behind UTC.
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "soon";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Pulls the server's own `{ error: "..." }` message out of a failed API
 * call — used specifically for the AI spend-control responses (429 quota,
 * 503 paused), which carry a message written for the student to read
 * directly, rather than a generic "something went wrong".
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const data = error.data as { error?: string } | null;
    if (data?.error) return data.error;
  }
  return fallback;
}

/** True when the failed API call was the AI spend-control 429 or 503. */
export function isBudgetError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 429 || error.status === 503);
}
