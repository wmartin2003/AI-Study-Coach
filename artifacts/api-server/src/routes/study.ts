import { Router, type IRouter } from "express";
import {
  CreateCourseBody,
  CreateCourseResponse,
  GetDashboardResponse,
  GetProfileResponse,
  GetQuizResponse,
  GetTutorConversationResponse,
  ListCoursesResponse,
  SendTutorMessageBody,
  SendTutorMessageResponse,
  SubmitQuizAnswerBody,
  SubmitQuizAnswerResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { aiRateLimit } from "../middlewares/rate-limit";
import { assembleContext, generateReply, type TutorTurn } from "../lib/tutor";
import { generateQuizQuestions } from "../lib/quiz";
import { generateTopicOutline } from "../lib/courses";
import { applyQuizResult, touchStreak } from "../lib/mastery";
import { retrieveRelevantChunks } from "../lib/documents";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(requireAuth);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

router.get("/profile", async (req, res) => {
  const { data, error } = await req.supabase!
    .from("profiles")
    .select("*")
    .eq("id", req.user!.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Profile not found" });

  return res.json(
    GetProfileResponse.parse({
      id: data.id,
      fullName: data.full_name,
      gradeLevel: data.grade_level,
      studyMinutesPerDay: data.study_minutes_per_day,
      learningStyle: data.learning_style,
      onboardingCompleted: data.onboarding_completed,
    }),
  );
});

router.patch("/profile", async (req, res) => {
  const input = UpdateProfileBody.parse(req.body);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.fullName !== undefined) patch["full_name"] = input.fullName;
  if (input.gradeLevel !== undefined) patch["grade_level"] = input.gradeLevel;
  if (input.studyMinutesPerDay !== undefined) patch["study_minutes_per_day"] = input.studyMinutesPerDay;
  if (input.learningStyle !== undefined) patch["learning_style"] = input.learningStyle;
  if (input.onboardingCompleted !== undefined) patch["onboarding_completed"] = input.onboardingCompleted;

  const { data, error } = await req.supabase!
    .from("profiles")
    .update(patch)
    .eq("id", req.user!.id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.json(
    UpdateProfileResponse.parse({
      id: data.id,
      fullName: data.full_name,
      gradeLevel: data.grade_level,
      studyMinutesPerDay: data.study_minutes_per_day,
      learningStyle: data.learning_style,
      onboardingCompleted: data.onboarding_completed,
    }),
  );
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

router.get("/dashboard", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;

  const [profileRes, statsRes, coursesRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("user_stats").select("xp, streak_days").eq("user_id", userId).maybeSingle(),
    supabase
      .from("courses")
      .select("id, name, exam_date, created_at")
      .eq("user_id", userId)
      .order("exam_date", { ascending: true, nullsFirst: false }),
  ]);

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = (profileRes.data?.full_name ?? "there").split(" ")[0];
  const greeting = `Good ${timeOfDay}, ${firstName}`;

  const course = coursesRes.data?.[0];

  if (!course) {
    return res.json(
      GetDashboardResponse.parse({
        greeting,
        courseName: "",
        courseProgress: 0,
        strongestTopic: "",
        focusTopic: "",
        tasks: [],
        xp: statsRes.data?.xp ?? 0,
        streak: statsRes.data?.streak_days ?? 0,
        questionsThisWeek: 0,
        masteredTopics: 0,
      }),
    );
  }

  const { data: topics } = await supabase
    .from("topics")
    .select("name, mastery_score")
    .eq("course_id", course.id)
    .order("mastery_score", { ascending: true })
    .order("order_index", { ascending: true });

  const scores = (topics ?? []).map((t) => Number(t.mastery_score));
  const courseProgress = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const focusTopic = topics?.[0]?.name ?? "";
  const strongestTopic = topics?.[topics.length - 1]?.name ?? "";

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
      courseName: course.name,
      courseProgress,
      strongestTopic,
      focusTopic,
      tasks,
      xp: statsRes.data?.xp ?? 0,
      streak: statsRes.data?.streak_days ?? 0,
      questionsThisWeek: questionsThisWeek ?? 0,
      masteredTopics: masteredTopics ?? 0,
    }),
  );
});

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

router.get("/courses", async (req, res) => {
  const supabase = req.supabase!;
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, name, level, exam_date")
    .eq("user_id", req.user!.id)
    .order("created_at", { ascending: true });

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

      return {
        id: course.id,
        name: course.name,
        examDate: course.exam_date ?? "",
        level: course.level,
        progress,
        topics: (topics ?? []).map((t) => ({
          name: t.name,
          masteryLevel: t.mastery_level,
          masteryScore: Number(t.mastery_score),
        })),
      };
    }),
  );

  return res.json(ListCoursesResponse.parse(result));
});

router.post("/courses", async (req, res) => {
  const supabase = req.supabase!;
  const userId = req.user!.id;
  const input = CreateCourseBody.parse(req.body);

  const { data: course, error } = await supabase
    .from("courses")
    .insert({ user_id: userId, name: input.name, exam_date: input.examDate, level: input.level })
    .select("id, name, level, exam_date")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  let topicNames: string[] = [];
  try {
    topicNames = await generateTopicOutline(input.name, input.level);
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
    CreateCourseResponse.parse({
      id: course.id,
      name: course.name,
      examDate: course.exam_date ?? "",
      level: course.level,
      progress: 0,
      topics: topicNames.map((name) => ({ name, masteryLevel: "not_started", masteryScore: 0 })),
    }),
  );
});

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

router.get("/tutor/conversation", async (req, res) => {
  const supabase = req.supabase!;
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", req.user!.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
        .insert({ user_id: userId, title: input.context ?? null })
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

    const context = await assembleContext(supabase, userId, input.context);
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
  const { data: course } = await supabase
    .from("courses")
    .select("id, name, level")
    .eq("user_id", userId)
    .order("exam_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!course) return null;

  const { data: topic } = await supabase
    .from("topics")
    .select("id, name")
    .eq("course_id", course.id)
    .order("mastery_score", { ascending: true })
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!topic) return null;

  const questions = await generateQuizQuestions({
    courseName: course.name,
    topicName: topic.name,
    count: 10,
    level: course.level,
  });

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .insert({ user_id: userId, course_id: course.id, topic_id: topic.id, total_questions: questions.length })
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
