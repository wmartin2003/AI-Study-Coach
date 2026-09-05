import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Awards a course-completion badge using the course's real topic mastery at
 * the moment of completion — never a placeholder number. Idempotent: the
 * unique (user_id, key) constraint on achievements means re-completing a
 * course (e.g. after reactivating) just updates the existing badge.
 */
export async function awardCompletionBadge(
  supabase: SupabaseClient,
  userId: string,
  course: { id: string; name: string; course_code: string | null },
): Promise<void> {
  const { data: topics } = await supabase
    .from("topics")
    .select("id, mastery_score")
    .eq("course_id", course.id);

  const scores = (topics ?? []).map((t) => Number(t.mastery_score));
  const averageMastery = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const topicIds = (topics ?? []).map((t) => t.id);

  let questionsAnswered = 0;
  if (topicIds.length) {
    const { data: questionRows } = await supabase.from("quiz_questions").select("id").in("topic_id", topicIds);
    const questionIds = (questionRows ?? []).map((q) => q.id);
    if (questionIds.length) {
      const { count } = await supabase
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("quiz_question_id", questionIds);
      questionsAnswered = count ?? 0;
    }
  }

  await supabase.from("achievements").upsert(
    {
      user_id: userId,
      key: `course_completed:${course.id}`,
      title: course.name,
      description: course.course_code,
      course_id: course.id,
      earned_at: new Date().toISOString(),
      metadata: { averageMastery, questionsAnswered },
    },
    { onConflict: "user_id,key" },
  );
}
