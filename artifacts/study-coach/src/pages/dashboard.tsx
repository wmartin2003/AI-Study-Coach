import { ArrowRight, BookOpen, Calendar, Check, ChevronDown, Clock3, Lightbulb, Plus, RotateCcw, Target, Trophy, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { getGetDashboardQueryKey, useGetDashboard } from "@workspace/api-client-react";
import type { Dashboard } from "@workspace/api-client-react";
import { AppShell, Button, EmptyState, ErrorNotice, PageHeading, ProgressBar, SkeletonBlock, StatPill } from "@/components/app-shell";
import { formatDate } from "@/lib/format";

const COLLAPSED_TASK_COUNT = 3;

export default function DashboardPage() {
  const dashboardQuery = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const data = dashboardQuery.data;
  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const completed = tasks.filter((task) => task.completed).length;
  const dayLabel = useMemo(() => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }), []);
  const [planExpanded, setPlanExpanded] = useState(false);
  const visibleTasks = planExpanded ? tasks : tasks.slice(0, COLLAPSED_TASK_COUNT);
  const hiddenCount = tasks.length - COLLAPSED_TASK_COUNT;

  return <AppShell>
    <div className="coach-rise">
      <PageHeading eyebrow={dayLabel} title={data?.greeting || "Good morning"} description="Your next best step is ready when you are."
        action={<Link href="/tutor" data-testid="link-dashboard-tutor" className="hidden items-center gap-2 text-[13px] font-semibold text-primary transition-transform hover:translate-x-0.5 sm:flex">Need a nudge? <ArrowRight className="h-4 w-4" /></Link>} />
      {dashboardQuery.isLoading ? <DashboardSkeleton /> : dashboardQuery.isError ? <ErrorNotice onRetry={() => dashboardQuery.refetch()} /> : !data?.courseName ? (
        <EmptyState title="Add your first course" description="Once you add a course, your coach will build a daily plan and track your progress here." action={<Link href="/courses/new" data-testid="link-dashboard-add-course"><Button><Plus className="h-4 w-4" /> Add a course</Button></Link>} />
      ) : <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[26px] bg-sidebar p-6 text-sidebar-foreground shadow-xl shadow-sidebar/20 sm:p-8">
          <div className="absolute -right-8 -top-20 h-64 w-64 rounded-full border-[36px] border-accent/15" /><div className="absolute -bottom-24 right-28 h-48 w-48 rounded-full border-[20px] border-sidebar-foreground/5" />
          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div><div className="mb-5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/55"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Your study desk</div>
              <p className="max-w-md font-display text-3xl font-semibold leading-[1.1] tracking-[-0.04em] sm:text-[40px]">One clear session<br />for <span className="text-accent">{data.courseName || "your course"}</span>.</p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-sidebar-foreground/65">Start with {data.focusTopic || "your focus topic"} while your attention is fresh. You only need to begin.</p>
              <Link href="/course" data-testid="link-start-session" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-[13px] font-bold text-accent-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/20">Start today's session <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="rounded-2xl border border-sidebar-foreground/10 bg-sidebar-foreground/[.06] p-5 backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between"><span className="text-[12px] text-sidebar-foreground/60">Course progress</span><span className="font-mono-ui text-[12px] text-accent">{data.courseProgress}%</span></div>
              <ProgressBar value={data.courseProgress} className="[&>div]:bg-accent bg-sidebar-foreground/10" />
              <div className="mt-5 flex items-end justify-between"><div><p className="text-[11px] text-sidebar-foreground/45">Strongest so far</p><p className="mt-1 text-sm font-semibold">{data.strongestTopic || "Keep building"}</p></div><Trophy className="h-5 w-5 text-accent" /></div>
            </div>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">The plan</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-primary">Today's rhythm</h2></div><span className="rounded-full bg-secondary px-3 py-1.5 font-mono-ui text-[10px] text-muted-foreground">{completed} of {tasks.length} done</span></div>
            <div className="space-y-2">{visibleTasks.map((task, index) => <TaskRow key={`${task.label}-${index}`} task={task} index={index} />)}</div>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setPlanExpanded((value) => !value)}
                data-testid="button-toggle-plan"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary hover:text-primary"
              >
                {planExpanded ? "Show less" : `Show ${hiddenCount} more ${hiddenCount === 1 ? "activity" : "activities"}`}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${planExpanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </section>
          <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/25 text-primary"><Target className="h-4 w-4" /></div><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">A gentle focus</p><h2 className="mt-0.5 font-display text-xl font-semibold text-primary">Build this next</h2></div></div>
            <div className="rounded-2xl bg-secondary/70 p-4"><p className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Focus topic</p><p className="mt-2 font-display text-[22px] font-semibold leading-tight text-primary">{data.focusTopic || "Add your first topic"}</p><p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{data.focusReason || "A short explanation with your tutor will make this click."}</p><Link href="/tutor" data-testid="link-focus-tutor" className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary">Explore with tutor <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            {data.strongestTopic && <div className="mt-4 flex items-center gap-3 border-t border-border pt-4"><Lightbulb className="h-4 w-4 text-chart-3" /><p className="text-[12px] text-muted-foreground">Your strongest topic is <strong className="font-semibold text-primary">{data.strongestTopic}</strong>.</p></div>}
          </section>
        </div>
        {data.upcomingEvents.length > 0 && (
          <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Coming up</p></div>
            <div className="space-y-2">
              {data.upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3" data-testid={`row-upcoming-${event.id}`}>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-primary">{event.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{event.courseName}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 font-mono-ui text-[10px] text-muted-foreground">{formatDate(event.eventDate)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4"><StatPill label="Study streak" value={`${data.streak || 0} ${data.streak === 1 ? "day" : "days"}`} accent /><StatPill label="Earned XP" value={`${data.xp || 0} xp`} /><StatPill label="Questions this week" value={`${data.questionsThisWeek || 0}`} /><StatPill label="Topics mastered" value={`${data.masteredTopics || 0}`} /></section>
      </div>}
    </div>
  </AppShell>;
}

const TASK_ICON: Record<string, typeof Zap> = { Quiz: Zap, Learn: BookOpen, Review: RotateCcw };

/**
 * Every task carries the real course (and, where relevant, topic/quiz) it's
 * about, so the arrow always lands somewhere genuinely useful instead of a
 * generic "/quiz" — a Learn task opens that exact topic's study guide, a
 * Review task with a quizId opens that quiz's review, and a mistakes-only
 * Review task goes to the tutor, which is the only place mistakes are
 * actually surfaced today.
 */
function taskHref(task: Dashboard["tasks"][number]): string {
  if (task.kind === "Learn" && task.topicName) {
    return `/course?course=${task.courseId}&tab=topics&topic=${encodeURIComponent(task.topicName)}&guide=1`;
  }
  if (task.kind === "Review" && task.quizId) {
    return `/quiz?course=${task.courseId}&review=${task.quizId}`;
  }
  if (task.kind === "Review") {
    return `/tutor?course=${task.courseId}`;
  }
  if (task.kind === "Quiz") {
    return `/quiz?course=${task.courseId}`;
  }
  return `/course?course=${task.courseId}`;
}

function TaskRow({ task, index }: { task: Dashboard["tasks"][number]; index: number }) {
  const Icon = TASK_ICON[task.kind] ?? Clock3;
  return <div className={`group flex items-center gap-3 rounded-2xl border p-3 transition-colors ${task.completed ? "border-transparent bg-secondary/60" : "border-border hover:border-primary/25 hover:bg-secondary/40"}`} data-testid={`row-task-${index}`}>
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${task.completed ? "bg-primary text-primary-foreground" : "bg-accent/25 text-primary"}`}>{task.completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div>
    <div className="min-w-0 flex-1">
      <p className={`truncate text-[13px] font-semibold ${task.completed ? "text-muted-foreground line-through" : "text-primary"}`}>{task.label}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{task.kind} · {task.duration} · {task.courseName}</p>
    </div>
    {!task.completed && <Link href={taskHref(task)} data-testid={`link-task-${index}`} className="rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-primary group-hover:opacity-100"><ArrowRight className="h-4 w-4" /></Link>}
  </div>;
}

function DashboardSkeleton() {
  return <div className="space-y-6"><SkeletonBlock className="h-[280px] rounded-[26px]" /><div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><SkeletonBlock className="h-[310px]" /><SkeletonBlock className="h-[310px]" /></div></div>;
}