import { ArrowRight, Check, ChevronLeft, CircleAlert, ListChecks, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useGetQuiz, useSubmitQuizAnswer, getGetQuizQueryKey } from "@workspace/api-client-react";
import type { QuizFeedback } from "@workspace/api-client-react";
import { AppShell, Button, EmptyState, ErrorNotice, PageHeading, ProgressBar, SkeletonBlock } from "@/components/app-shell";

export default function QuizPage() {
  const quizQuery = useGetQuiz({ query: { queryKey: getGetQuizQueryKey() } });
  const submitAnswer = useSubmitQuizAnswer();
  const question = quizQuery.data;
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [answers, setAnswers] = useState(0);
  const noCourseYet = quizQuery.isError && quizQuery.error?.status === 404;

  const answer = () => {
    if (!selected || submitAnswer.isPending || feedback || !question) return;
    submitAnswer.mutate(
      { data: { questionId: question.id, answer: selected } },
      { onSuccess: (result) => { setFeedback(result); if (result.correct) setAnswers((value) => value + 1); } },
    );
  };
  const next = async () => {
    setFeedback(null);
    setSelected(null);
    await quizQuery.refetch();
  };
  return <AppShell><div className="coach-rise"><PageHeading eyebrow="Adaptive practice" title="Test your recall." description="Ten thoughtful questions, tuned to what you are learning." action={<div className="flex items-center gap-2 rounded-full bg-accent/25 px-3 py-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"><Sparkles className="h-3.5 w-3.5" /> {answers} correct so far</div>} />
    {quizQuery.isLoading ? <QuizSkeleton /> : noCourseYet ? <EmptyState title="Add a course to unlock practice" description="Once you add a course, your coach builds tailored questions from what you're studying." action={<Link href="/courses/new" data-testid="link-quiz-add-course"><Button><Plus className="h-4 w-4" /> Add a course</Button></Link>} /> : quizQuery.isError || !question ? <ErrorNotice onRetry={() => quizQuery.refetch()} /> : <div className="mx-auto max-w-[880px]"><div className="mb-5 flex items-center gap-4"><span className="font-mono-ui text-[11px] font-semibold text-primary">Question {question.number} <span className="text-muted-foreground">/ {question.total}</span></span><ProgressBar value={(question.number / question.total) * 100} className="flex-1" /><span className="rounded-full bg-secondary px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">{question.difficulty}</span></div>
      <section className="rounded-[26px] border border-border bg-card p-5 sm:p-9"><div className="mb-8 flex items-center justify-between"><span className="rounded-full bg-secondary px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-[0.13em] text-primary">{question.topic}</span><ListChecks className="h-5 w-5 text-muted-foreground" /></div><h2 className="max-w-2xl font-display text-3xl font-semibold leading-[1.15] tracking-[-0.035em] text-primary sm:text-[38px]">{question.question}</h2><div className="mt-8 grid gap-2.5">{question.options.map((option, index) => { const isSelected = selected === option; const isCorrect = feedback && isSelected && feedback.correct; const isWrong = feedback && isSelected && !feedback.correct; return <button type="button" key={option} onClick={() => !feedback && setSelected(option)} data-testid={`button-answer-${index}`} className={`group flex items-center gap-3 rounded-2xl border p-4 text-left text-[13px] transition-all ${isCorrect ? "border-chart-2/60 bg-chart-2/10" : isWrong ? "border-destructive/40 bg-destructive/5" : isSelected ? "border-primary bg-secondary" : "border-border hover:border-primary/30 hover:bg-secondary/60"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono-ui text-[11px] font-semibold ${isCorrect ? "border-chart-2 bg-chart-2 text-primary-foreground" : isWrong ? "border-destructive bg-destructive text-destructive-foreground" : isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground group-hover:border-primary/50 group-hover:text-primary"}`}>{feedback && isCorrect ? <Check className="h-3.5 w-3.5" /> : feedback && isWrong ? <X className="h-3.5 w-3.5" /> : String.fromCharCode(65 + index)}</span><span className={`${isCorrect ? "font-semibold text-primary" : "text-primary"}`}>{option}</span></button>; })}</div>
        {submitAnswer.isError && !feedback && <div className="mt-6"><ErrorNotice message="Couldn't check that answer just now." /></div>}
        {!feedback ? <div className="mt-8 flex flex-col-reverse items-center justify-between gap-4 border-t border-border pt-5 sm:flex-row"><button type="button" onClick={() => setSelected(null)} data-testid="button-clear-answer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-primary"><ChevronLeft className="h-3.5 w-3.5" /> Clear choice</button><Button onClick={answer} disabled={!selected || submitAnswer.isPending} testId="button-submit-answer">{submitAnswer.isPending ? "Checking..." : "Lock in answer"} <ArrowRight className="h-4 w-4" /></Button></div> : <div className={`mt-6 rounded-2xl border p-5 ${feedback.correct ? "border-chart-2/30 bg-chart-2/10" : "border-destructive/20 bg-destructive/5"}`}><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${feedback.correct ? "bg-chart-2 text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>{feedback.correct ? <Check className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}</div><div><p className="text-[13px] font-bold text-primary">{feedback.correct ? "Nice work — that's it." : "Not this time, and that's useful."}</p><p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{feedback.explanation}</p><p className="mt-3 font-mono-ui text-[10px] font-semibold uppercase tracking-wider text-primary">+{feedback.xp} XP · Next: {feedback.nextTopic}</p></div></div><Button onClick={next} variant={feedback.correct ? "primary" : "secondary"} testId="button-next-question" className="mt-4">Next question <ArrowRight className="h-4 w-4" /></Button></div>}</section>
    </div>}</div></AppShell>;
}
function QuizSkeleton() { return <div className="mx-auto max-w-[880px]"><SkeletonBlock className="mb-5 h-4" /><SkeletonBlock className="h-[600px] rounded-[26px]" /></div>; }