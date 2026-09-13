/**
 * Server-side feature flags. Each one is checked before any work for that
 * feature happens — a flag that only hides a button in React is decoration,
 * not a lock: the Supabase session token lives in the browser, so anyone
 * can call the route directly. The real lock lives in the route handler.
 */

export function tutorEnabled(): boolean {
  return process.env["TUTOR_ENABLED"] === "true";
}

export const TUTOR_DISABLED_MESSAGE = "The AI tutor isn't available yet. Your plan, courses, and quizzes are all still here.";
