import type { SupabaseClient } from "@supabase/supabase-js";

function levelForScore(score: number): string {
  if (score <= 0) return "not_started";
  if (score < 30) return "learning";
  if (score < 60) return "developing";
  if (score < 85) return "proficient";
  return "mastered";
}

/**
 * Nudges a topic's mastery score toward 100 on a correct answer and pulls it
 * down on a miss, with diminishing steps as the score approaches either end —
 * simple, bounded, and self-correcting rather than a flat +/- per question.
 */
export async function applyQuizResult(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  correct: boolean,
): Promise<{ xp: number }> {
  const { data: existing } = await supabase
    .from("topic_mastery")
    .select("mastery_score, questions_answered, questions_correct")
    .eq("user_id", userId)
    .eq("topic_id", topicId)
    .maybeSingle();

  const currentScore = Number(existing?.mastery_score ?? 0);
  const nextScore = correct
    ? Math.min(100, currentScore + (100 - currentScore) * 0.35)
    : Math.max(0, currentScore - currentScore * 0.25);

  const questionsAnswered = (existing?.questions_answered ?? 0) + 1;
  const questionsCorrect = (existing?.questions_correct ?? 0) + (correct ? 1 : 0);

  await supabase.from("topic_mastery").upsert(
    {
      user_id: userId,
      topic_id: topicId,
      mastery_score: nextScore,
      level: levelForScore(nextScore),
      questions_answered: questionsAnswered,
      questions_correct: questionsCorrect,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,topic_id" },
  );

  await supabase
    .from("topics")
    .update({ mastery_score: nextScore, mastery_level: levelForScore(nextScore) })
    .eq("id", topicId);

  const xp = correct ? 10 : 3;

  const { data: stats } = await supabase
    .from("user_stats")
    .select("xp")
    .eq("user_id", userId)
    .maybeSingle();

  await supabase
    .from("user_stats")
    .update({ xp: (stats?.xp ?? 0) + xp, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { xp };
}

/**
 * Advances the study streak once per calendar day the student is active,
 * rather than on every request.
 */
export async function touchStreak(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: stats } = await supabase
    .from("user_stats")
    .select("streak_days, longest_streak, last_study_date")
    .eq("user_id", userId)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  if (stats?.last_study_date === today) return;

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const continuesStreak = stats?.last_study_date === yesterday;
  const streakDays = continuesStreak ? (stats?.streak_days ?? 0) + 1 : 1;

  await supabase
    .from("user_stats")
    .update({
      streak_days: streakDays,
      longest_streak: Math.max(streakDays, stats?.longest_streak ?? 0),
      last_study_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}
