import type { SupabaseClient } from "@supabase/supabase-js";
import { generateStructured } from "./anthropic";

export type PriorityCourse = {
  id: string;
  name: string;
  level: string;
  nearestEventDate: string | null;
  isSample: boolean;
};

/**
 * Picks which active course deserves attention right now: the one with the
 * nearest upcoming calendar event (exam, assignment, ...), falling back to
 * the nearest completion date, falling back to the most recently created
 * course. Shared by the dashboard and the quiz generator so they always
 * agree on "today's" course instead of each guessing independently.
 */
export async function pickPriorityCourse(
  supabase: SupabaseClient,
  userId: string,
): Promise<PriorityCourse | null> {
  const { data: courses } = await supabase
    .from("courses")
    .select("id, name, level, completion_date, created_at, is_sample")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!courses || courses.length === 0) return null;

  const courseIds = courses.map((c) => c.id);
  const today = new Date().toISOString().slice(0, 10);

  const { data: nearestEvent } = await supabase
    .from("course_events")
    .select("course_id, event_date")
    .in("course_id", courseIds)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nearestEvent) {
    const course = courses.find((c) => c.id === nearestEvent.course_id)!;
    return {
      id: course.id,
      name: course.name,
      level: course.level,
      nearestEventDate: nearestEvent.event_date,
      isSample: Boolean(course.is_sample),
    };
  }

  const byCompletionDate = [...courses].sort((a, b) => {
    if (!a.completion_date) return 1;
    if (!b.completion_date) return -1;
    return a.completion_date.localeCompare(b.completion_date);
  });

  const chosen = byCompletionDate[0];
  return { id: chosen.id, name: chosen.name, level: chosen.level, nearestEventDate: null, isSample: Boolean(chosen.is_sample) };
}

export async function generateTopicOutline(userId: string, courseName: string, level: string): Promise<string[]> {
  const result = await generateStructured<{ topics: string[] }>({
    userId,
    feature: "topics",
    system:
      "You design study curricula. Given a course name and level, break it into 4-6 major topic areas a student would progress through, ordered from foundational to advanced. Keep each topic name short (2-5 words).",
    prompt: `Course: ${courseName}\nLevel: ${level}\n\nList the topic areas for this course.`,
    toolName: "outline_topics",
    toolDescription: "Return an ordered list of topic area names for a course.",
    inputSchema: {
      type: "object",
      properties: {
        topics: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
      },
      required: ["topics"],
    },
  });

  return result.topics;
}
