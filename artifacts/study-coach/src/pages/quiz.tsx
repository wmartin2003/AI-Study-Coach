import {
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  CircleAlert,
  Eye,
  ListChecks,
  Plus,
  Shuffle,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "wouter";
import {
  getGetActiveQuizQueryKey,
  getGetQuizReviewQueryKey,
  getListCourseQuizzesQueryKey,
  getListCoursesQueryKey,
  useGetActiveQuiz,
  useGetQuizReview,
  useListCourseQuizzes,
  useListCourses,
  useStartQuiz,
  useSubmitQuizAnswer,
} from "@workspace/api-client-react";
import type { ActiveQuiz, Course, CourseTopic, CompletedQuiz, QuizFeedback, QuizQuestion } from "@workspace/api-client-react";
import { AppShell, Button, EmptyState, ErrorNotice, PageHeading, ProgressBar, SkeletonBlock, StatPill } from "@/components/app-shell";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { queryClient } from "@/lib/query-client";
import { formatDate, getApiErrorMessage, isBudgetError } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

type PageMode = "hub" | "active" | "completed";

const MASTERY_LABEL: Record<string, string> = {
  not_started: "Not started",
  learning: "Recommended next",
  developing: "Building up",
  proficient: "Solid foundation",
  mastered: "Mastered",
};

export default function QuizPage() {
  const [searchParams] = useSearchParams();
  const coursesQuery = useListCourses(undefined, { query: { queryKey: getListCoursesQueryKey() } });
  const courses = (coursesQuery.data ?? []).filter((c) => c.status === "active");
  const activeQuizQuery = useGetActiveQuiz({ query: { queryKey: getGetActiveQuizQueryKey() } });
  const startQuiz = useStartQuiz();
  const submitAnswer = useSubmitQuizAnswer();

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(searchParams.get("course"));
  const [mode, setMode] = useState<PageMode>("hub");
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  // Lets a dashboard "Review: X" task deep-link straight into that quiz's
  // review dialog instead of just landing on the hub.
  const [reviewQuizId, setReviewQuizId] = useState<string | null>(searchParams.get("review"));

  useEffect(() => {
    if (!courses.length) return;
    if (!courses.some((c) => c.id === selectedCourseId)) setSelectedCourseId(courses[0].id);
  }, [courses, selectedCourseId]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;

  const beginQuiz = (topicName: string | null, focus?: "balanced" | "weak-spots") => {
    if (!selectedCourse) return;
    startQuiz.mutate(
      { data: { courseId: selectedCourse.id, topicName: topicName ?? undefined, focus } },
      {
        onSuccess: (result) => {
          setQuestion(result);
          setMode("active");
          setFeedback(null);
          setSelectedAnswer(null);
          setSessionCorrect(0);
          setSessionXp(0);
          queryClient.invalidateQueries({ queryKey: getGetActiveQuizQueryKey() });
        },
        onError: (err) => {
          toast({
            title: isBudgetError(err) ? "AI allowance reached" : "Couldn't build a quiz",
            description: getApiErrorMessage(err, "Couldn't build a quiz just now. Please try again."),
            variant: "destructive",
          });
        },
      },
    );
  };

  const resumeActive = () => {
    // Only reached once we've confirmed `active.id` is set, which per the
    // API contract means every field on ActiveQuiz is populated.
    const active = activeQuizQuery.data as QuizQuestion | undefined;
    if (!active?.id) return;
    setQuestion(active);
    setMode("active");
    setFeedback(null);
    setSelectedAnswer(null);
    setSessionCorrect(0);
    setSessionXp(0);
  };

  const exitQuiz = () => {
    setMode("hub");
    setQuestion(null);
    setFeedback(null);
    setSelectedAnswer(null);
    activeQuizQuery.refetch();
  };

  const answer = () => {
    if (!selectedAnswer || submitAnswer.isPending || feedback || !question) return;
    submitAnswer.mutate(
      { data: { questionId: question.id, answer: selectedAnswer } },
      {
        onSuccess: (result) => {
          setFeedback(result);
          if (result.correct) setSessionCorrect((c) => c + 1);
          setSessionXp((xp) => xp + result.xp);
        },
      },
    );
  };

  const next = async () => {
    if (!feedback || !question) return;
    if (feedback.quizCompleted) {
      setMode("completed");
      queryClient.invalidateQueries({ queryKey: getListCourseQuizzesQueryKey(question.courseId) });
      queryClient.invalidateQueries({ queryKey: getGetActiveQuizQueryKey() });
      return;
    }
    setFeedback(null);
    setSelectedAnswer(null);
    const result = await activeQuizQuery.refetch();
    const nextQuestion = result.data as QuizQuestion | undefined;
    if (nextQuestion?.id) setQuestion(nextQuestion);
  };

  const backToHub = () => {
    setMode("hub");
    setQuestion(null);
    setFeedback(null);
  };

  const activeBanner = activeQuizQuery.data as QuizQuestion | undefined;

  return (
    <AppShell>
      <div className="coach-rise">
        {mode === "active" && question ? (
          <ActiveQuizView
            question={question}
            selectedAnswer={selectedAnswer}
            onSelect={setSelectedAnswer}
            feedback={feedback}
            onAnswer={answer}
            onNext={next}
            onExit={exitQuiz}
            answering={submitAnswer.isPending}
            answerFailed={submitAnswer.isError && !feedback}
            sessionCorrect={sessionCorrect}
          />
        ) : mode === "completed" && question && feedback ? (
          <CompletedView
            question={question}
            feedback={feedback}
            sessionXp={sessionXp}
            onReview={() => setReviewQuizId(question.quizId)}
            onBack={backToHub}
          />
        ) : (
          <>
            <PageHeading
              eyebrow="Adaptive practice"
              title="Test your recall."
              description="Pick a course, then a topic quiz or an overall review. Everything you finish is saved here for review."
            />
            {coursesQuery.isLoading ? (
              <QuizHubSkeleton />
            ) : coursesQuery.isError && !coursesQuery.data ? (
              <ErrorNotice onRetry={() => coursesQuery.refetch()} />
            ) : courses.length === 0 ? (
              <EmptyState
                title="Add a course to unlock practice"
                description="Once you add a course, your coach builds tailored questions from what you're studying."
                action={
                  <Link href="/courses/new" data-testid="link-quiz-add-course">
                    <Button><Plus className="h-4 w-4" /> Add a course</Button>
                  </Link>
                }
              />
            ) : (
              <>
                {activeBanner?.id && <ContinueBanner active={activeBanner} onContinue={resumeActive} />}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[.72fr_1.28fr]">
                  <CourseList courses={courses} selectedId={selectedCourseId} onSelect={setSelectedCourseId} />
                  {selectedCourse && (
                    <CourseQuizHub
                      course={selectedCourse}
                      starting={startQuiz.isPending}
                      onStartTopic={(topicName) => beginQuiz(topicName)}
                      onStartOverall={(focus) => beginQuiz(null, focus)}
                      onReview={setReviewQuizId}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {reviewQuizId && <QuizReviewDialog quizId={reviewQuizId} onClose={() => setReviewQuizId(null)} />}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Hub: course list + per-course quiz options
// ---------------------------------------------------------------------------

function ContinueBanner({ active, onContinue }: { active: QuizQuestion; onContinue: () => void }) {
  return (
    <button
      type="button"
      onClick={onContinue}
      data-testid="button-continue-quiz"
      className="mb-6 flex w-full items-center gap-4 rounded-[22px] border border-accent/40 bg-accent/10 p-4 text-left transition-colors hover:bg-accent/15 sm:p-5"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono-ui text-[9px] font-bold uppercase tracking-wider text-primary">Pick up where you left off</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-primary">
          {active.courseName} · {active.topic} — question {active.number} of {active.total}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
    </button>
  );
}

function CourseList({ courses, selectedId, onSelect }: { courses: Course[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <aside className="space-y-4">
      <div className="rounded-[22px] border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">My courses</p>
          <ListChecks className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          {courses.map((course) => (
            <button
              type="button"
              onClick={() => onSelect(course.id)}
              key={course.id}
              data-testid={`button-quiz-course-${course.id}`}
              className={`w-full rounded-2xl border p-3 text-left transition-all ${
                selectedId === course.id ? "border-primary/25 bg-secondary shadow-sm" : "border-transparent hover:border-border hover:bg-secondary/60"
              }`}
            >
              <p className="truncate text-[13px] font-semibold text-primary">{course.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{course.topics.length} topics · {course.progress}% mapped</p>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-[22px] bg-sidebar p-5 text-sidebar-foreground">
        <div className="mb-3 flex items-center gap-2 text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em]">Coach's note</span>
        </div>
        <p className="text-[13px] font-semibold leading-snug">Mix it up.</p>
        <p className="mt-2 text-[12px] leading-relaxed text-sidebar-foreground/65">
          Topic quizzes build a skill. Overall reviews catch the gaps between topics that a single-topic quiz never
          will.
        </p>
      </div>
    </aside>
  );
}

function CourseQuizHub({
  course,
  starting,
  onStartTopic,
  onStartOverall,
  onReview,
}: {
  course: Course;
  starting: boolean;
  onStartTopic: (topicName: string) => void;
  onStartOverall: (focus: "balanced" | "weak-spots") => void;
  onReview: (quizId: string) => void;
}) {
  const quizzesQuery = useListCourseQuizzes(course.id, { query: { queryKey: getListCourseQuizzesQueryKey(course.id) } });
  const pastQuizzes = quizzesQuery.data ?? [];

  return (
    <section className="rounded-[22px] border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Practice for</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-primary">{course.name}</h2>
        </div>
        <div className="min-w-[120px]">
          <div className="mb-2 flex justify-between text-[11px]">
            <span className="text-muted-foreground">Overall</span>
            <span className="font-mono-ui font-semibold text-primary">{course.progress}%</span>
          </div>
          <ProgressBar value={course.progress} />
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Overall quizzes</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onStartOverall("balanced")}
            disabled={starting || course.topics.length === 0}
            data-testid="button-quiz-overall-balanced"
            className="flex items-start gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary/30 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-primary">
              <Shuffle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-primary">Full course review</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">10 questions spread evenly across every topic</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onStartOverall("weak-spots")}
            disabled={starting || course.topics.length === 0}
            data-testid="button-quiz-overall-weak-spots"
            className="flex items-start gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary/30 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-primary">Weak spots review</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">10 questions, weighted toward your lowest-mastery topics</p>
            </div>
          </button>
        </div>
        {course.topics.length === 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">Add topics to this course to unlock quizzes.</p>
        )}
      </div>

      <div className="mt-7">
        <p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Topic quizzes</p>
        {course.topics.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">This course doesn't have any topics yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {course.topics.map((topic) => (
              <TopicQuizCard key={topic.name} topic={topic} disabled={starting} onStart={() => onStartTopic(topic.name)} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-7 border-t border-border pt-6">
        <p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Past quizzes</p>
        {quizzesQuery.isLoading ? (
          <SkeletonBlock className="h-[100px]" />
        ) : pastQuizzes.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Finish a quiz and it'll show up here for review.</p>
        ) : (
          <div className="space-y-2">
            {pastQuizzes.map((quiz) => (
              <PastQuizRow key={quiz.id} quiz={quiz} onReview={() => onReview(quiz.id)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TopicQuizCard({ topic, disabled, onStart }: { topic: CourseTopic; disabled: boolean; onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      data-testid={`button-quiz-topic-${topic.name}`}
      className="rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary/30 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/25 text-primary">
          <ListChecks className="h-4 w-4" />
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-3 truncate text-[13px] font-semibold text-primary">{topic.name}</p>
      <ProgressBar value={topic.masteryScore} className="mt-2.5 h-1.5" />
      <p className="mt-1.5 text-[10px] text-muted-foreground">{MASTERY_LABEL[topic.masteryLevel] ?? topic.masteryLevel}</p>
    </button>
  );
}

function scorePercent(quiz: { correctCount: number; totalQuestions: number }): number {
  if (quiz.totalQuestions <= 0) return 0;
  return Math.round((quiz.correctCount / quiz.totalQuestions) * 100);
}

function scoreBadgeClass(percent: number): string {
  if (percent >= 80) return "bg-chart-2/15 text-chart-2";
  if (percent >= 50) return "bg-accent/25 text-primary";
  return "bg-destructive/10 text-destructive";
}

function PastQuizRow({ quiz, onReview }: { quiz: CompletedQuiz; onReview: () => void }) {
  const percent = scorePercent(quiz);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-3.5" data-testid={`row-past-quiz-${quiz.id}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono-ui text-[10px] font-bold ${scoreBadgeClass(percent)}`}>
        {percent}%
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-primary">{quiz.title ?? quiz.topicName ?? "Quiz"}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatDate(quiz.completedAt)} · {quiz.correctCount}/{quiz.totalQuestions} correct
        </p>
      </div>
      <button
        type="button"
        onClick={onReview}
        title="Review"
        data-testid={`button-review-quiz-${quiz.id}`}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  );
}

function QuizHubSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[.72fr_1.28fr]">
      <SkeletonBlock className="h-[280px]" />
      <SkeletonBlock className="h-[520px]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active quiz-taking view
// ---------------------------------------------------------------------------

function ActiveQuizView({
  question,
  selectedAnswer,
  onSelect,
  feedback,
  onAnswer,
  onNext,
  onExit,
  answering,
  answerFailed,
  sessionCorrect,
}: {
  question: QuizQuestion;
  selectedAnswer: string | null;
  onSelect: (option: string | null) => void;
  feedback: QuizFeedback | null;
  onAnswer: () => void;
  onNext: () => void;
  onExit: () => void;
  answering: boolean;
  answerFailed: boolean;
  sessionCorrect: number;
}) {
  return (
    <>
      <PageHeading
        eyebrow="Adaptive practice"
        title="Test your recall."
        description={`Practicing ${question.courseName}.`}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExit}
              data-testid="button-exit-quiz"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Exit
            </button>
            <div className="flex items-center gap-2 rounded-full bg-accent/25 px-3 py-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {sessionCorrect} correct so far
            </div>
          </div>
        }
      />
      <div className="mx-auto max-w-[880px]">
        <div className="mb-5 flex items-center gap-4">
          <span className="font-mono-ui text-[11px] font-semibold text-primary">
            Question {question.number} <span className="text-muted-foreground">/ {question.total}</span>
          </span>
          <ProgressBar value={(question.number / question.total) * 100} className="flex-1" />
          <span className="rounded-full bg-secondary px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">
            {question.difficulty}
          </span>
        </div>
        <section className="rounded-[26px] border border-border bg-card p-5 sm:p-9">
          <div className="mb-8 flex items-center justify-between">
            <span className="rounded-full bg-secondary px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-[0.13em] text-primary">{question.topic}</span>
            <ListChecks className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="max-w-2xl font-display text-3xl font-semibold leading-[1.15] tracking-[-0.035em] text-primary sm:text-[38px]">
            {question.question}
          </h2>
          <div className="mt-8 grid gap-2.5">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = feedback && isSelected && feedback.correct;
              const isWrong = feedback && isSelected && !feedback.correct;
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => !feedback && onSelect(option)}
                  data-testid={`button-answer-${index}`}
                  className={`group flex items-center gap-3 rounded-2xl border p-4 text-left text-[13px] transition-all ${
                    isCorrect
                      ? "border-chart-2/60 bg-chart-2/10"
                      : isWrong
                        ? "border-destructive/40 bg-destructive/5"
                        : isSelected
                          ? "border-primary bg-secondary"
                          : "border-border hover:border-primary/30 hover:bg-secondary/60"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono-ui text-[11px] font-semibold ${
                      isCorrect
                        ? "border-chart-2 bg-chart-2 text-primary-foreground"
                        : isWrong
                          ? "border-destructive bg-destructive text-destructive-foreground"
                          : isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground group-hover:border-primary/50 group-hover:text-primary"
                    }`}
                  >
                    {feedback && isCorrect ? <Check className="h-3.5 w-3.5" /> : feedback && isWrong ? <X className="h-3.5 w-3.5" /> : String.fromCharCode(65 + index)}
                  </span>
                  <span className={isCorrect ? "font-semibold text-primary" : "text-primary"}>{option}</span>
                </button>
              );
            })}
          </div>
          {answerFailed && (
            <div className="mt-6">
              <ErrorNotice message="Couldn't check that answer just now." />
            </div>
          )}
          {!feedback ? (
            <div className="mt-8 flex flex-col-reverse items-center justify-between gap-4 border-t border-border pt-5 sm:flex-row">
              <button type="button" onClick={() => onSelect(null)} data-testid="button-clear-answer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-primary">
                <ChevronLeft className="h-3.5 w-3.5" /> Clear choice
              </button>
              <Button onClick={onAnswer} disabled={!selectedAnswer || answering} testId="button-submit-answer">
                {answering ? "Checking..." : "Lock in answer"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className={`mt-6 rounded-2xl border p-5 ${feedback.correct ? "border-chart-2/30 bg-chart-2/10" : "border-destructive/20 bg-destructive/5"}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${feedback.correct ? "bg-chart-2 text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
                  {feedback.correct ? <Check className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-primary">{feedback.correct ? "Nice work — that's it." : "Not this time, and that's useful."}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{feedback.explanation}</p>
                  <p className="mt-3 font-mono-ui text-[10px] font-semibold uppercase tracking-wider text-primary">+{feedback.xp} XP · Topic: {feedback.topicName}</p>
                </div>
              </div>
              <Button onClick={onNext} variant={feedback.correct ? "primary" : "secondary"} testId="button-next-question" className="mt-4">
                {feedback.quizCompleted ? "See your results" : "Next question"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function scoreMessage(correct: number, total: number): string {
  const percent = total > 0 ? (correct / total) * 100 : 0;
  if (percent >= 90) return "Outstanding work!";
  if (percent >= 70) return "Nice work!";
  if (percent >= 50) return "Good effort.";
  return "Keep at it — you'll get there.";
}

function CompletedView({
  question,
  feedback,
  sessionXp,
  onReview,
  onBack,
}: {
  question: QuizQuestion;
  feedback: QuizFeedback;
  sessionXp: number;
  onReview: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <PageHeading eyebrow="Adaptive practice" title="Test your recall." description={`Practicing ${question.courseName}.`} />
      <section className="mx-auto max-w-[560px] rounded-[26px] border border-border bg-card p-8 text-center sm:p-10" data-testid="section-quiz-completed">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/25 text-primary">
          <Award className="h-6 w-6" />
        </div>
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Quiz complete</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-primary">{scoreMessage(feedback.correctCount, feedback.totalQuestions)}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">{question.courseName}</p>
        <div className="mt-7 grid grid-cols-3 gap-3">
          <StatPill label="Score" value={`${feedback.correctCount}/${feedback.totalQuestions}`} />
          <StatPill label="XP earned" value={`+${sessionXp}`} accent />
          <StatPill label="Accuracy" value={`${Math.round((feedback.correctCount / Math.max(1, feedback.totalQuestions)) * 100)}%`} />
        </div>
        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button variant="secondary" onClick={onReview} testId="button-review-completed-quiz">
            Review answers
          </Button>
          <Button onClick={onBack} testId="button-back-to-hub">
            Back to quizzes
          </Button>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Review dialog
// ---------------------------------------------------------------------------

function QuizReviewDialog({ quizId, onClose }: { quizId: string; onClose: () => void }) {
  const reviewQuery = useGetQuizReview(quizId, { query: { queryKey: getGetQuizReviewQueryKey(quizId) } });
  const review = reviewQuery.data;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-[24px]" data-testid="dialog-quiz-review">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold text-primary">
            {review?.title ?? review?.topicName ?? "Quiz review"}
          </DialogTitle>
        </DialogHeader>

        {reviewQuery.isLoading && (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Loading your quiz...</div>
        )}
        {reviewQuery.isError && <ErrorNotice onRetry={() => reviewQuery.refetch()} message="Couldn't load this quiz just now." />}

        {review && (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
              <span>
                {review.courseName} · {formatDate(review.completedAt)}
              </span>
              <span className="font-mono-ui font-semibold text-primary">
                {review.correctCount}/{review.totalQuestions} correct
              </span>
            </div>
            {review.questions.map((q) => {
              const status = q.selectedAnswer === null ? "skipped" : q.correct ? "correct" : "wrong";
              return (
                <div key={q.number} className="rounded-2xl border border-border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">
                      Question {q.number}
                      {q.topicName ? ` · ${q.topicName}` : ""}
                    </span>
                    {status === "correct" && (
                      <span className="flex items-center gap-1 font-mono-ui text-[10px] font-bold uppercase tracking-wider text-chart-2">
                        <Check className="h-3 w-3" /> Correct
                      </span>
                    )}
                    {status === "wrong" && (
                      <span className="flex items-center gap-1 font-mono-ui text-[10px] font-bold uppercase tracking-wider text-destructive">
                        <X className="h-3 w-3" /> Missed
                      </span>
                    )}
                    {status === "skipped" && (
                      <span className="font-mono-ui text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Skipped</span>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-primary">{q.question}</p>
                  <div className="mt-3 grid gap-1.5">
                    {q.options.map((option, index) => {
                      const isCorrectOption = option === q.correctAnswer;
                      const isSelected = option === q.selectedAnswer;
                      return (
                        <div
                          key={option}
                          className={`rounded-xl border px-3 py-2 text-[12px] ${
                            isCorrectOption
                              ? "border-chart-2/50 bg-chart-2/10 text-primary"
                              : isSelected
                                ? "border-destructive/40 bg-destructive/5 text-primary"
                                : "border-border text-muted-foreground"
                          }`}
                        >
                          {String.fromCharCode(65 + index)}. {option}
                          {isCorrectOption ? " ✓" : isSelected ? " (your answer)" : ""}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{q.explanation}</p>}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="mt-2 flex-row justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
