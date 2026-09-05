import { Router, type IRouter } from "express";
import {
  ArchiveCourseResponse,
  CompleteCourseResponse,
  CreateCourseBody,
  CreateCourseResponse,
  GetDashboardResponse,
  GetProfileResponse,
  GetQuizResponse,
  GetTutorConversationResponse,
  ListCoursesResponse,
  ReactivateCourseResponse,
  SendTutorMessageBody,
  SendTutorMessageResponse,
  SubmitQuizAnswerBody,
  SubmitQuizAnswerResponse,
  UpdateCourseBody,
  UpdateCourseResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { aiRateLimit } from "../middlewares/rate-limit";
import { assembleContext, generateReply, type TutorTurn } from "../lib/tutor";
import { generateQuizQuestions } from "../lib/quiz";
import { generateTopicOutline, pickPriorityCourse } from "../lib/courses";
import { applyQuizResult, touchStreak } from "../lib/mastery";
import { retrieveRelevantChunks } from "../lib/documents";
import { awardCompletionBadge } from "../lib/badges";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(requireAuth);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function toProfileResponse(data: Record<string, unknown>) {
  return {
    id: data.id,
    fullName: data.full_name,
    firstName: data.first_name,
    lastName: data.last_name,
    gradeLevel: data.grade_level,
    studyMinutesPerDay: data.study_minutes_per_day,
    learningStyle: data.learning_style,
    country: data.country,
    educationLevel: data.education_level,
    institutionName: data.institution_name,
    programMajor: data.program_major,
    gradeYear: data.grade_year,
    expectedCompletionDate: data.expected_completion_date,
    onboardingCompleted: data.onboarding_completed,
  };
}

router.get("/profile", async (req, res) => {
  const { data, error } = await req.supabase!
    .from("profiles")
    .select("*")
    .eq("id", req.user!.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Profile not found" });

  return res.json(GetProfileResponse.parse(toProfileResponse(data)));
});

router.patch("/profile", async (req, res) => {
  const input = UpdateProfileBody.parse(req.body);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.fullName !== undefined) patch["full_name"] = input.fullName;
  if (input.firstName !== undefined) patch["first_name"] = input.firstName;
  if (input.lastName !== undefined) patch["last_name"] = input.lastName;
  if (input.gradeLevel !== undefined) patch["grade_level"] = input.gradeLevel;
  if (input.studyMinutesPerDay !== undefined) patch["study_minutes_per_day"] = input.studyMinutesPerDay;
  if (input.learningStyle !== undefined) patch["learning_style"] = input.learningStyle;
  if (input.country !== undefined) patch["country"] = input.country;
  if (input.educationLevel !== undefined) patch["education_level"] = input.educationLevel;
  if (input.institutionName !== undefined) patch["institution_name"] = input.institutionName;
  if (input.programMajor !== undefined) patch["program_major"] = input.programMajor;
  if (input.gradeYear !== undefined) patch["grade_year"] = input.gradeYear;
  if (input.expectedCompletionDate !== undefined) patch["expected_completion_date"] = input.expectedCompletionDate;
  if (input.onboardingCompleted !== undefined) patch["onboarding_completed"] = input.onboardingCompleted;

  // A first/last name update keeps `full_name` (used for greetings and the
  // tutor's "Student:" context line) in sync rather than leaving it stale.
  if (input.firstName !== undefined || input.lastName !== undefined) {
    const first = input.firstName ?? "";
    const last = input.lastName ?? "";
    const combined = `${first} ${last}`.trim();
    if (combined) patch["full_name"] = combined;
  }

  const { data, error } = await req.supabase!
    .from("profiles")
    .update(patch)
    .eq("id", req.user!.id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.json(UpdateProfileResponse.parse(toProfileResponse(data)));
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

router.get("/dashboard", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;

  const [profileRes, statsRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("user_stats").select("xp, streak_days").eq("user_id", userId).maybeSingle(),
  ]);

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = (profileRes.data?.full_name ?? "there").split(" ")[0];
  const greeting = `Good ${timeOfDay}, ${firstName}`;

  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingRows } = await supabase
    .from("course_events")
    .select("id, course_id, type, title, event_date, courses!inner(name, status)")
    .eq("user_id", userId)
    .eq("courses.status", "active")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(5);

  const upcomingEvents = ((upcomingRows ?? []) as unknown as Array<{
    id: string;
    course_id: string;
    type: string;
    title: string;
    event_date: string;
    courses: { name: string };
  }>).map((row) => ({
    id: row.id,
    courseName: row.courses.name,
    type: row.type,
    title: row.title,
    eventDate: row.event_date,
  }));

  const priorityCourse = await pickPriorityCourse(supabase, userId);

  if (!priorityCourse) {
    return res.json(
      GetDashboardResponse.parse({
        greeting,
        courseName: "",
        courseProgress: 0,
        strongestTopic: "",
        focusTopic: "",
        focusReason: "",
        tasks: [],
        xp: statsRes.data?.xp ?? 0,
        streak: statsRes.data?.streak_days ?? 0,
        questionsThisWeek: 0,
        masteredTopics: 0,
        upcomingEvents,
      }),
    );
  }

  const { data: topics } = await supabase
    .from("topics")
    .select("name, mastery_score")
    .eq("course_id", priorityCourse.id)
    .order("mastery_score", { ascending: true })
    .order("order_index", { ascending: true });

  const scores = (topics ?? []).map((t) => Number(t.mastery_score));
  const courseProgress = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const focusTopic = topics?.[0]?.name ?? "";
  const focusScore = topics?.[0] ? Math.round(Number(topics[0].mastery_score)) : 0;
  const strongestTopic = topics?.[topics.length - 1]?.name ?? "";

  let focusReason = focusTopic
    ? `Your current mastery here is ${focusScore}%.`
    : "";
  if (priorityCourse.nearestEventDate) {
    const days = Math.ceil(
      (new Date(priorityCourse.nearestEventDate).getTime() - new Date(today).getTime()) / 86_400_000,
    );
    const dayLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    focusReason = focusTopic
      ? `You have an upcoming deadline ${dayLabel} and your current mastery here is ${focusScore}%.`
      : `You have an upcoming deadline ${dayLabel}.`;
  }

  const { count: unresolvedMistakes } = await supabase
    .from("mistakes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("resolved", false);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: attemptsToday } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", todayStart.toISOString());

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const { count: questionsThisWeek } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", weekStart.toISOString());

  const { count: masteredTopics } = await supabase
    .from("topic_mastery")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("level", "mastered");

  const tasks = [
    (unresolvedMistakes ?? 0) > 0
      ? { label: "Review mistakes", duration: "10 min", kind: "Review", completed: false }
      : { label: `Review: ${strongestTopic}`, duration: "10 min", kind: "Review", completed: true },
    { label: `Learn: ${focusTopic}`, duration: "15 min", kind: "Learn", completed: false },
    {
      label: "Practice: 10 questions",
      duration: "15 min",
      kind: "Practice",
      completed: (attemptsToday ?? 0) >= 10,
    },
  ];

  return res.json(
    GetDashboardResponse.parse({
      greeting,
      courseName: priorityCourse.name,
      courseProgress,
      strongestTopic,
      focusTopic,
      focusReason,
      tasks,
      xp: statsRes.data?.xp ?? 0,
      streak: statsRes.data?.streak_days ?? 0,
      questionsThisWeek: questionsThisWeek ?? 0,
      masteredTopics: masteredTopics ?? 0,
      upcomingEvents,
    }),
  );
});

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

function toCourseResponse(course: Record<string, any>, progress: number, topics: unknown[]) {
  return {
    id: course.id,
    name: course.name,
    completionDate: course.completion_date ?? null,
    level: course.level,
    status: course.status,
    courseCode: course.course_code ?? null,
    institution: course.institution ?? null,
    instructor: course.instructor ?? null,
    term: course.term ?? null,
    completedAt: course.completed_at ?? null,
    progress,
    topics,
  };
}

router.get("/courses", async (req, res) => {
  const supabase = req.supabase!;
  const statusFilter = typeof req.query.status === "string" ? req.query.status : null;

  let query = supabase
    .from("courses")
    .select("id, name, level, completion_date, status, course_code, institution, instructor, term, completed_at")
    .eq("user_id", req.user!.id)
    .order("created_at", { ascending: true });
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: courses, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const result = await Promise.all(
    (courses ?? []).map(async (course) => {
      const { data: topics } = await supabase
        .from("topics")
        .select("name, mastery_score, mastery_level")
        .eq("course_id", course.id)
        .order("order_index", { ascending: true });

      const scores = (topics ?? []).map((t) => Number(t.mastery_score));
      const progress = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      return toCourseResponse(
        course,
        progress,
        (topics ?? []).map((t) => ({ name: t.name, masteryLevel: t.mastery_level, masteryScore: Number(t.mastery_score) })),
      );
    }),
  );

  return res.json(ListCoursesResponse.parse(result));
});

router.post("/courses", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const input = CreateCourseBody.parse(req.body);
  const name = input.name.trim();
  if (!name) return res.status(400).json({ error: "Course name can't be blank." });
  const level = input.level || "Undergraduate";

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      user_id: userId,
      name,
      completion_date: input.completionDate || null,
      level,
      course_code: input.courseCode || null,
      institution: input.institution || null,
      instructor: input.instructor || null,
      term: input.term || null,
    })
    .select("id, name, level, completion_date, status, course_code, institution, instructor, term, completed_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  let topicNames: string[] = [];
  try {
    topicNames = await generateTopicOutline(name, level);
  } catch (err) {
    logger.error({ err }, "Failed to generate topic outline; course created without topics");
  }

  if (topicNames.length) {
    await supabase.from("topics").insert(
      topicNames.map((name, index) => ({
        user_id: userId,
        course_id: course.id,
        name,
        order_index: index,
      })),
    );
  }

  return res.status(201).json(
    CreateCourseResponse.parse(
      toCourseResponse(
        course,
        0,
        topicNames.map((name) => ({ name, masteryLevel: "not_started", masteryScore: 0 })),
      ),
    ),
  );
});

router.patch("/courses/:courseId", async (req, res) => {
  const supabase = req.supabase!;
  const input = UpdateCourseBody.parse(req.body);

  if (input.name !== undefined && !input.name.trim()) {
    return res.status(400).json({ error: "Course name can't be blank." });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch["name"] = input.name.trim();
  if (input.completionDate !== undefined) patch["completion_date"] = input.completionDate || null;
  if (input.level !== undefined) patch["level"] = input.level;
  if (input.courseCode !== undefined) patch["course_code"] = input.courseCode || null;
  if (input.institution !== undefined) patch["institution"] = input.institution || null;
  if (input.instructor !== undefined) patch["instructor"] = input.instructor || null;
  if (input.term !== undefined) patch["term"] = input.term || null;

  const { data: course, error } = await supabase
    .from("courses")
    .update(patch)
    .eq("id", req.params.courseId)
    .select("id, name, level, completion_date, status, course_code, institution, instructor, term, completed_at")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!course) return res.status(404).json({ error: "Course not found" });

  const { data: topics } = await supabase
    .from("topics")
    .select("name, mastery_score, mastery_level")
    .eq("course_id", course.id)
    .order("order_index", { ascending: true });
  const scores = (topics ?? []).map((t) => Number(t.mastery_score));
  const progress = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return res.json(
    UpdateCourseResponse.parse(
      toCourseResponse(
        course,
        progress,
        (topics ?? []).map((t) => ({ name: t.name, masteryLevel: t.mastery_level, masteryScore: Number(t.mastery_score) })),
      ),
    ),
  );
});

router.post("/courses/:courseId/complete", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;

  const { data: course, error } = await supabase
    .from("courses")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", req.params.courseId)
    .select("id, name, level, completion_date, status, course_code, institution, instructor, term, completed_at")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!course) return res.status(404).json({ error: "Course not found" });

  await awardCompletionBadge(supabase, userId, { id: course.id, name: course.name, course_code: course.course_code });

  const { data: topics } = await supabase
    .from("topics")
    .select("name, mastery_score, mastery_level")
    .eq("course_id", course.id)
    .order("order_index", { ascending: true });
  const scores = (topics ?? []).map((t) => Number(t.mastery_score));
  const progress = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return res.json(
    CompleteCourseResponse.parse(
      toCourseResponse(
        course,
        progress,
        (topics ?? []).map((t) => ({ name: t.name, masteryLevel: t.mastery_level, masteryScore: Number(t.mastery_score) })),
      ),
    ),
  );
});

async function setCourseStatus(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  courseId: string,
  status: "active" | "archived",
) {
  const { data: course, error } = await supabase
    .from("courses")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .select("id, name, level, completion_date, status, course_code, institution, instructor, term, completed_at")
    .maybeSingle();

  if (error) throw error;
  if (!course) return null;

  const { data: topics } = await supabase
    .from("topics")
    .select("name, mastery_score, mastery_level")
    .eq("course_id", course.id)
    .order("order_index", { ascending: true });
  const scores = (topics ?? []).map((t) => Number(t.mastery_score));
  const progress = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return toCourseResponse(
    course,
    progress,
    (topics ?? []).map((t) => ({ name: t.name, masteryLevel: t.mastery_level, masteryScore: Number(t.mastery_score) })),
  );
}

router.post("/courses/:courseId/archive", async (req, res) => {
  const result = await setCourseStatus(req.supabase!, req.params.courseId, "archived");
  if (!result) return res.status(404).json({ error: "Course not found" });
  return res.json(ArchiveCourseResponse.parse(result));
});

router.post("/courses/:courseId/reactivate", async (req, res) => {
  const result = await setCourseStatus(req.supabase!, req.params.courseId, "active");
  if (!result) return res.status(404).json({ error: "Course not found" });
  return res.json(ReactivateCourseResponse.parse(result));
});

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

router.get("/tutor/conversation", async (req, res) => {
  const supabase = req.supabase!;
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : null;

  let query = supabase
    .from("conversations")
    .select("id")
    .eq("user_id", req.user!.id)
    .order("updated_at", { ascending: false })
    .limit(1);
  query = courseId ? query.eq("course_id", courseId) : query.is("course_id", null);

  const { data: conversation } = await query.maybeSingle();

  if (!conversation) {
    return res.json(GetTutorConversationResponse.parse({ conversationId: null, messages: [] }));
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  return res.json(
    GetTutorConversationResponse.parse({
      conversationId: conversation.id,
      messages: (messages ?? []).map((m) => ({
        role: m.role === "user" ? "student" : "assistant",
        message: m.content,
      })),
    }),
  );
});

router.post("/tutor/messages", aiRateLimit, async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const input = SendTutorMessageBody.parse(req.body);

  try {
    let conversationId = input.conversationId ?? null;

    if (conversationId) {
      const { data } = await supabase.from("conversations").select("id").eq("id", conversationId).maybeSingle();
      if (!data) conversationId = null;
    }

    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ user_id: userId, course_id: input.courseId ?? null, title: input.topicName ?? null })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = created.id;
    }

    const { data: historyRows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const history: TutorTurn[] = (historyRows ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const context = await assembleContext(supabase, userId, input.courseId, input.topicName);
    const retrieval = await retrieveRelevantChunks(supabase, userId, context.courseId, input.message);
    const reply = await generateReply(context, history, input.message, retrieval);

    await supabase.from("messages").insert([
      { user_id: userId, conversation_id: conversationId, role: "user", content: input.message },
      { user_id: userId, conversation_id: conversationId, role: "assistant", content: reply.message },
    ]);
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    await touchStreak(supabase, userId);

    res.json(
      SendTutorMessageResponse.parse({
        role: "assistant",
        message: reply.message,
        prompt: reply.prompt,
        conversationId,
      }),
    );
  } catch (err) {
    logger.error({ err }, "Tutor message failed");
    res.status(502).json({ error: "The tutor couldn't respond just now." });
  }
});

// ---------------------------------------------------------------------------
// Adaptive quiz
// ---------------------------------------------------------------------------

async function startNewQuiz(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
  const priorityCourse = await pickPriorityCourse(supabase, userId);
  if (!priorityCourse) return null;

  const { data: topic } = await supabase
    .from("topics")
    .select("id, name")
    .eq("course_id", priorityCourse.id)
    .order("mastery_score", { ascending: true })
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!topic) return null;

  const questions = await generateQuizQuestions({
    courseName: priorityCourse.name,
    topicName: topic.name,
    count: 10,
    level: priorityCourse.level,
  });

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .insert({ user_id: userId, course_id: priorityCourse.id, topic_id: topic.id, total_questions: questions.length })
    .select("id, total_questions")
    .single();
  if (error) throw error;

  const { data: inserted, error: qError } = await supabase
    .from("quiz_questions")
    .insert(
      questions.map((q, index) => ({
        user_id: userId,
        quiz_id: quiz.id,
        topic_id: topic.id,
        question_number: index + 1,
        question_text: q.questionText,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })),
    )
    .select("id, question_number, question_text, options, difficulty");
  if (qError) throw qError;

  const first = inserted.find((q) => q.question_number === 1)!;
  return {
    id: first.id,
    number: 1,
    total: quiz.total_questions,
    topic: topic.name,
    question: first.question_text,
    options: first.options as string[],
    difficulty: first.difficulty,
  };
}

router.get("/quiz", aiRateLimit, async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;

  try {
    const { data: activeQuiz } = await supabase
      .from("quizzes")
      .select("id, total_questions, topic_id, topics(name)")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeQuiz) {
      const { data: questions } = await supabase
        .from("quiz_questions")
        .select("id, question_number, question_text, options, difficulty")
        .eq("quiz_id", activeQuiz.id)
        .order("question_number", { ascending: true });

      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("quiz_question_id")
        .eq("user_id", userId)
        .in("quiz_question_id", (questions ?? []).map((q) => q.id));

      const answeredIds = new Set((attempts ?? []).map((a) => a.quiz_question_id));
      const next = (questions ?? []).find((q) => !answeredIds.has(q.id));

      if (next) {
        const topicName = (activeQuiz as unknown as { topics: { name: string } | null }).topics?.name ?? "";
        return res.json(
          GetQuizResponse.parse({
            id: next.id,
            number: next.question_number,
            total: activeQuiz.total_questions,
            topic: topicName,
            question: next.question_text,
            options: next.options as string[],
            difficulty: next.difficulty,
          }),
        );
      }

      await supabase
        .from("quizzes")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", activeQuiz.id);
    }

    const question = await startNewQuiz(supabase, userId);
    if (!question) {
      return res.status(404).json({ error: "Add a course first to unlock practice questions." });
    }
    return res.json(GetQuizResponse.parse(question));
  } catch (err) {
    logger.error({ err }, "Quiz generation failed");
    return res.status(502).json({ error: "Couldn't build a quiz just now." });
  }
});

router.post("/quiz/answers", aiRateLimit, async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const input = SubmitQuizAnswerBody.parse(req.body);

  const { data: question, error } = await supabase
    .from("quiz_questions")
    .select("correct_answer, explanation, topic_id, question_text, topics(name)")
    .eq("id", input.questionId)
    .maybeSingle();

  if (error || !question) return res.status(404).json({ error: "Question not found" });

  const correct = input.answer === question.correct_answer;
  const { xp } = await applyQuizResult(supabase, userId, question.topic_id, correct);
  await touchStreak(supabase, userId);

  await supabase.from("quiz_attempts").insert({
    user_id: userId,
    quiz_question_id: input.questionId,
    selected_answer: input.answer,
    correct,
    xp_awarded: xp,
  });

  if (!correct) {
    await supabase.from("mistakes").insert({
      user_id: userId,
      topic_id: question.topic_id,
      question_text: question.question_text,
      student_answer: input.answer,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
    });
  }

  const topicName = (question as unknown as { topics: { name: string } | null }).topics?.name ?? "";

  return res.json(
    SubmitQuizAnswerResponse.parse({
      correct,
      explanation: question.explanation ?? "",
      xp,
      nextTopic: topicName,
    }),
  );
});

export default router;
