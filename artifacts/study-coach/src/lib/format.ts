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
