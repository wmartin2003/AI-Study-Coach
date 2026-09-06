import type { SupabaseClient } from "@supabase/supabase-js";

// Entirely hardcoded — this runs for every new signup, so it must never
// make an Anthropic call (or cost anything at all). A brand-new account
// that skips onboarding without adding a course would otherwise land on a
// completely empty dashboard; this gives them something real to look at
// and delete once they've added their own course.
const SAMPLE_COURSE_NAME = "Intro to Psychology";
const SAMPLE_TOPICS = [
  "History & Major Perspectives",
  "Research Methods",
  "Biological Bases of Behavior",
  "Learning & Memory",
  "Motivation & Emotion",
];

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Seeds one hardcoded sample course for a brand-new account — called once,
 * right when onboarding completes, only if the student hasn't already
 * created a course of their own. Marked `is_sample` so the UI can show a
 * "this is an example" banner; deletion goes through the normal
 * course-deletion path, no special-casing needed there.
 */
export async function seedSampleCourse(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      user_id: userId,
      name: SAMPLE_COURSE_NAME,
      level: "Undergraduate",
      is_sample: true,
    })
    .select("id")
    .single();
  if (courseError || !course) return;

  await supabase.from("topics").insert(
    SAMPLE_TOPICS.map((name, index) => ({
      user_id: userId,
      course_id: course.id,
      name,
      order_index: index,
    })),
  );

  await supabase.from("course_events").insert([
    {
      user_id: userId,
      course_id: course.id,
      type: "quiz",
      title: "Chapter 1–2 quiz",
      event_date: daysFromNow(4),
      source: "manual",
    },
    {
      user_id: userId,
      course_id: course.id,
      type: "midterm",
      title: "Midterm exam",
      event_date: daysFromNow(21),
      source: "manual",
    },
  ]);
}
