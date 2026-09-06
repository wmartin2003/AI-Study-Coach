import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanTask = {
  label: string;
  duration: string;
  kind: "Review" | "Learn" | "Quiz";
  completed: boolean;
  courseId: string;
  courseName: string;
  topicName: string | null;
  quizId: string | null;
};

const MAX_TASKS = 9;
const REVIEW_STALE_DAYS = 14;

/**
 * Builds today's plan across every active course, instead of just the one
 * "priority" course the hero section focuses on — mixing quiz practice,
 * quiz review, and study-guide learning rather than always the same three
 * generic steps.
 *
 * Prioritization: courses are ranked by how soon their next event (exam,
 * assignment, ...) is due, then by average mastery (weaker first) as a
 * tie-break. A course's own tasks are emitted together and in that
 * priority order, so "a midterm in 2 days" reliably pushes that whole
 * course's work to the top — the plan doesn't dilute it by round-robining
 * across courses just for variety.
 */
export async function buildPlan(supabase: SupabaseClient, userId: string): Promise<PlanTask[]> {
  const { data: courses } = await supabase.from("courses").select("id, name").eq("user_id", userId).eq("status", "active");
  if (!courses || courses.length === 0) return [];

  const courseIds = courses.map((c) => c.id);
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const staleBefore = new Date(todayStart.getTime() - REVIEW_STALE_DAYS * 86_400_000).toISOString();

  const [{ data: events }, { data: topics }, { data: mistakes }, { data: completedQuizzes }] = await Promise.all([
    supabase
      .from("course_events")
      .select("course_id, event_date")
      .eq("user_id", userId)
      .in("course_id", courseIds)
      .gte("event_date", today)
      .order("event_date", { ascending: true }),
    supabase
      .from("topics")
      .select("course_id, name, mastery_score")
      .eq("user_id", userId)
      .in("course_id", courseIds)
      .order("mastery_score", { ascending: true })
      .order("order_index", { ascending: true }),
    supabase.from("mistakes").select("course_id").eq("user_id", userId).eq("resolved", false).in("course_id", courseIds),
    supabase
      .from("quizzes")
      .select("id, course_id, title, completed_at, topics(name)")
      .eq("user_id", userId)
      .eq("status", "completed")
      .in("course_id", courseIds)
      .order("completed_at", { ascending: false })
      .limit(50),
  ]);

  const nearestEventDaysByCourse = new Map<string, number>();
  for (const row of events ?? []) {
    if (nearestEventDaysByCourse.has(row.course_id)) continue; // ordered ascending — first seen is nearest
    const days = Math.ceil((new Date(row.event_date).getTime() - new Date(today).getTime()) / 86_400_000);
    nearestEventDaysByCourse.set(row.course_id, Math.max(0, days));
  }

  const topicsByCourse = new Map<string, { name: string; masteryScore: number }[]>();
  for (const row of topics ?? []) {
    const list = topicsByCourse.get(row.course_id) ?? [];
    list.push({ name: row.name, masteryScore: Number(row.mastery_score) });
    topicsByCourse.set(row.course_id, list);
  }

  const mistakeCourseIds = new Set((mistakes ?? []).map((m) => m.course_id).filter((id): id is string => Boolean(id)));

  const quizRows = (completedQuizzes ?? []) as unknown as Array<{
    id: string;
    course_id: string;
    title: string | null;
    completed_at: string;
    topics: { name: string } | null;
  }>;
  const latestQuizByCourse = new Map<string, { id: string; title: string | null; topicName: string | null; completedAt: string }>();
  for (const row of quizRows) {
    if (latestQuizByCourse.has(row.course_id)) continue; // ordered by completed_at desc — first seen is latest
    latestQuizByCourse.set(row.course_id, { id: row.id, title: row.title, topicName: row.topics?.name ?? null, completedAt: row.completed_at });
  }
  const quizDoneTodayCourseIds = new Set(quizRows.filter((row) => row.completed_at >= todayIso).map((row) => row.course_id));

  const averageMastery = (courseId: string): number => {
    const list = topicsByCourse.get(courseId) ?? [];
    if (!list.length) return 0;
    return list.reduce((sum, t) => sum + t.masteryScore, 0) / list.length;
  };

  const ranked = [...courses].sort((a, b) => {
    const aDays = nearestEventDaysByCourse.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bDays = nearestEventDaysByCourse.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aDays !== bDays) return aDays - bDays;
    return averageMastery(a.id) - averageMastery(b.id);
  });

  const tasks: PlanTask[] = [];
  for (const course of ranked) {
    const weakestTopic = (topicsByCourse.get(course.id) ?? [])[0] ?? null;
    const latestQuiz = latestQuizByCourse.get(course.id);

    if (latestQuiz && latestQuiz.completedAt >= staleBefore) {
      tasks.push({
        label: `Review: ${latestQuiz.title ?? latestQuiz.topicName ?? "your last quiz"}`,
        duration: "5 min",
        kind: "Review",
        completed: false,
        courseId: course.id,
        courseName: course.name,
        topicName: latestQuiz.topicName,
        quizId: latestQuiz.id,
      });
    } else if (mistakeCourseIds.has(course.id)) {
      tasks.push({
        label: `Review mistakes in ${course.name}`,
        duration: "5 min",
        kind: "Review",
        completed: false,
        courseId: course.id,
        courseName: course.name,
        topicName: null,
        quizId: null,
      });
    }

    if (weakestTopic) {
      tasks.push({
        label: `Study guide: ${weakestTopic.name}`,
        duration: "10 min",
        kind: "Learn",
        completed: false,
        courseId: course.id,
        courseName: course.name,
        topicName: weakestTopic.name,
        quizId: null,
      });
    }

    tasks.push({
      label: weakestTopic ? `Quiz: ${weakestTopic.name}` : `Quiz: ${course.name}`,
      duration: "15 min",
      kind: "Quiz",
      completed: quizDoneTodayCourseIds.has(course.id),
      courseId: course.id,
      courseName: course.name,
      topicName: weakestTopic?.name ?? null,
      quizId: null,
    });
  }

  return tasks.slice(0, MAX_TASKS);
}
