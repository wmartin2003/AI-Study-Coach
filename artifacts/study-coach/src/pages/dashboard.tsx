import { ArrowRight, BookOpen, Check, Clock3, Lightbulb, Target, Trophy, Zap } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";
import { getGetDashboardQueryKey, useGetDashboard } from "@workspace/api-client-react";
import type { Dashboard } from "@workspace/api-client-react";
import { AppShell, Button, ErrorNotice, PageHeading, ProgressBar, SkeletonBlock, StatPill } from "@/components/app-shell";

const fallbackDashboard: Dashboard = {
  greeting: "Good morning, Alex",
  courseName: "Computer Networks",
  courseProgress: 68,
  strongestTopic: "TCP congestion control",
  focusTopic: "Routing protocols",
  tasks: [
    { label: "Review distance-vector routing", duration: "18 min", kind: "Review", completed: false },
    { label: "Socratic session: BGP paths", duration: "12 min", kind: "Tutor", completed: false },
    { label: "Adaptive quiz · 10 questions", duration: "15 min", kind: "Quiz", completed: true },
  ],
  xp: 1240,
  streak: 6,
};

export default function DashboardPage() {
  const dashboardQuery = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const data = dashboardQuery.data ?? fallbackDashboard;
  const tasks = useMemo(() => data.tasks ?? fallbackDashboard.tasks, [data.tasks]);
  const completed = tasks.filter((task) => task.completed).length;

  return <AppShell>
    <div className="coach-rise">
      <PageHeading eyebrow="Tuesday, October 15" title={data.greeting || "Good morning"} description="Your next best step is ready when you are."
        action={<Link href="/tutor" data-testid="link-dashboard-tutor" className="hidden items-center gap-2 text-[13px] font-semibold text-primary transition-transform hover:translate-x-0.5 sm:flex">Need a nudge? <ArrowRight className="h-4 w-4" /></Link>} />
      {dashboardQuery.isLoading ? <DashboardSkeleton /> : dashboardQuery.isError ? <ErrorNotice onRetry={() => dashboardQuery.refetch()} /> : <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[26px] bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/10 sm:p-8">
          <div className="absolute -right-8 -top-20 h-64 w-64 rounded-full border-[36px] border-accent/15" /><div className="absolute -bottom-24 right-28 h-48 w-48 rounded-full border-[20px] border-primary-foreground/5" />
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div><div className="mb-5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-primary-foreground/55"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Your study desk</div>
              <p className="max-w-md font-display text-3xl font-semibold leading-[1.1] tracking-[-0.04em] sm:text-[40px]">One clear session<br />for <span className="text-accent">{data.courseName || "your course"}</span>.</p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-primary-foreground/65">Start with {data.focusTopic || "your focus topic"} while your attention is fresh. You only need to begin.</p>
              <Link href="/course" data-testid="link-start-session" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-[13px] font-bold text-accent-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/20">Start today's session <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/[.06] p-5 backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between"><span className="text-[12px] text-primary-foreground/60">Course progress</span><span className="font-mono-ui text-[12px] text-accent">{data.courseProgress}%</span></div>
              <ProgressBar value={data.courseProgress} className="[&>div]:bg-accent bg-primary-foreground/10" />
              <div className="mt-5 flex items-end justify-between"><div><p className="text-[11px] text-primary-foreground/45">Strongest so far</p><p className="mt-1 text-sm font-semibold">{data.strongestTopic || "Keep building"}</p></div><Trophy className="h-5 w-5 text-accent" /></div>
            </div>
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">The plan</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-primary">Today's rhythm</h2></div><span className="rounded-full bg-secondary px-3 py-1.5 font-mono-ui text-[10px] text-muted-foreground">{completed} of {tasks.length} done</span></div>
            <div className="space-y-2">{tasks.map((task, index) => <TaskRow key={`${task.label}-${index}`} task={task} index={index} />)}</div>
            <Link href="/quiz" data-testid="link-plan-quiz" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary hover:text-primary">Open the full plan <ArrowRight className="h-3.5 w-3.5" /></Link>
          </section>
          <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/25 text-primary"><Target className="h-4 w-4" /></div><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">A gentle focus</p><h2 className="mt-0.5 font-display text-xl font-semibold text-primary">Build this next</h2></div></div>
            <div className="rounded-2xl bg-secondary/70 p-4"><p className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Focus topic</p><p className="mt-2 font-display text-[22px] font-semibold leading-tight text-primary">{data.focusTopic || "Routing protocols"}</p><p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">A short explanation with your tutor will make this click.</p><Link href="/tutor" data-testid="link-focus-tutor" className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary">Explore with tutor <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4"><Lightbulb className="h-4 w-4 text-chart-3" /><p className="text-[12px] text-muted-foreground">Your strongest topic is <strong className="font-semibold text-primary">{data.strongestTopic || "TCP congestion control"}</strong>.</p></div>
          </section>
        </div>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4"><StatPill label="Study streak" value={`${data.streak || 0} days`} accent /><StatPill label="Earned XP" value={`${data.xp || 0} xp`} /><StatPill label="Sessions this week" value="4 sessions" /><StatPill label="Quiet wins" value="12 topics" /></section>
      </div>}
    </div>
  </AppShell>;
}

function TaskRow({ task, index }: { task: Dashboard["tasks"][number]; index: number }) {
  const Icon = task.kind.toLowerCase().includes("quiz") ? Zap : task.kind.toLowerCase().includes("tutor") ? BookOpen : Clock3;
  return <div className={`group flex items-center gap-3 rounded-2xl border p-3 transition-colors ${task.completed ? "border-transparent bg-secondary/60" : "border-border hover:border-primary/25 hover:bg-secondary/40"}`} data-testid={`row-task-${index}`}>
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${task.completed ? "bg-primary text-primary-foreground" : "bg-accent/25 text-primary"}`}>{task.completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div>
    <div className="min-w-0 flex-1"><p className={`truncate text-[13px] font-semibold ${task.completed ? "text-muted-foreground line-through" : "text-primary"}`}>{task.label}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{task.kind} · {task.duration}</p></div>
    {!task.completed && <Link href={task.kind.toLowerCase().includes("tutor") ? "/tutor" : "/quiz"} data-testid={`link-task-${index}`} className="rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-primary group-hover:opacity-100"><ArrowRight className="h-4 w-4" /></Link>}
  </div>;
}

function DashboardSkeleton() {
  return <div className="space-y-6"><SkeletonBlock className="h-[280px] rounded-[26px]" /><div className="grid gap-6 lg:grid-cols-2"><SkeletonBlock className="h-[310px]" /><SkeletonBlock className="h-[310px]" /></div></div>;
}