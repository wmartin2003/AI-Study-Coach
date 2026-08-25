import { ArrowRight, BookMarked, Check, ChevronDown, Circle, GraduationCap, Play, Plus, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getListCoursesQueryKey, useListCourses } from "@workspace/api-client-react";
import { AppShell, Button, EmptyState, ErrorNotice, PageHeading, ProgressBar, SkeletonBlock } from "@/components/app-shell";

export default function CoursePage() {
  const courseQuery = useListCourses({ query: { queryKey: getListCoursesQueryKey() } });
  const courses = courseQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && courses.length) setSelectedId(courses[0].id);
  }, [courses, selectedId]);

  const selected = courses.find((course) => course.id === selectedId) ?? courses[0];
  const [expanded, setExpanded] = useState(true);
  const topics = selected?.topics ?? [];
  return <AppShell>
    <div className="coach-rise">
      <PageHeading eyebrow="Course workspace" title={selected?.name || "Your courses"} description="A map of what you know, and the one thing worth touching next."
        action={<Link href="/courses/new" data-testid="link-course-new" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-primary transition-all hover:-translate-y-0.5 hover:shadow-md"><Plus className="h-4 w-4" /> Add course</Link>} />
      {courseQuery.isLoading ? <div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]"><SkeletonBlock className="h-[520px]" /><SkeletonBlock className="h-[520px]" /></div> : courseQuery.isError && !courseQuery.data ? <ErrorNotice onRetry={() => courseQuery.refetch()} /> : !selected ? <EmptyState title="Your desk is ready" description="Add your first course and we'll turn it into a focused path." action={<Link href="/courses/new" data-testid="link-empty-course"><Button><Plus className="h-4 w-4" /> Add a course</Button></Link>} /> : <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
        <aside className="space-y-4">
          <div className="rounded-[22px] border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between"><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">My courses</p><BookMarked className="h-4 w-4 text-muted-foreground" /></div>
            <div className="space-y-2">{courses.map((course) => <button type="button" onClick={() => setSelectedId(course.id)} key={course.id} data-testid={`button-course-${course.id}`} className={`w-full rounded-2xl border p-3 text-left transition-all ${selected?.id === course.id ? "border-primary/25 bg-secondary shadow-sm" : "border-transparent hover:border-border hover:bg-secondary/60"}`}><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${selected?.id === course.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><GraduationCap className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-primary">{course.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{course.progress}% mapped · exam {formatDate(course.examDate)}</p></div>{selected?.id === course.id && <ChevronDown className="mt-1 h-4 w-4 text-primary" />}</div></button>)}</div>
          </div>
          <div className="rounded-[22px] bg-primary p-5 text-primary-foreground"><div className="mb-4 flex items-center gap-2 text-accent"><Sparkles className="h-4 w-4" /><span className="font-mono-ui text-[10px] uppercase tracking-[0.14em]">Coach's note</span></div><p className="font-display text-[21px] font-semibold leading-tight">You don't need to cover everything today.</p><p className="mt-3 text-[12px] leading-relaxed text-primary-foreground/60">Follow the path on the right. It is shaped around your recent answers.</p></div>
        </aside>
        <section className="rounded-[22px] border border-border bg-card p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-start"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Your path</p><h2 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-primary">{selected.name}</h2></div><div className="min-w-[140px]"><div className="mb-2 flex justify-between text-[11px]"><span className="text-muted-foreground">Overall</span><span className="font-mono-ui font-semibold text-primary">{selected.progress}%</span></div><ProgressBar value={selected.progress} /></div></div>
          <div className="mt-6 flex items-center gap-2 text-[12px] text-muted-foreground"><span className="font-semibold text-primary">{topics.length} topic areas</span><Circle className="h-1.5 w-1.5 fill-current" /><span>Exam {formatDate(selected.examDate)}</span><Circle className="h-1.5 w-1.5 fill-current" /><span>{selected.level}</span></div>
          <div className="mt-8"><button type="button" onClick={() => setExpanded(!expanded)} data-testid="button-toggle-topics" className="mb-3 flex w-full items-center justify-between text-left"><span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Learning path</span><ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`} /></button>{expanded && <div className="relative space-y-1 pl-1">{topics.map((topic, index) => <TopicRow topic={topic} index={index} total={topics.length} key={topic.name} />)}</div>}</div>
          <div className="mt-8 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"><Link href="/tutor" data-testid="link-course-tutor" className="flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:border-primary/30 hover:bg-secondary"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/30 text-primary"><Search className="h-4 w-4" /></div><div><p className="text-[13px] font-semibold text-primary">Study with tutor</p><p className="mt-0.5 text-[11px] text-muted-foreground">Ask about any topic</p></div><ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link><Link href="/quiz" data-testid="link-course-quiz" className="flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:border-primary/30 hover:bg-secondary"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/30 text-primary"><Play className="h-4 w-4" /></div><div><p className="text-[13px] font-semibold text-primary">Test your recall</p><p className="mt-0.5 text-[11px] text-muted-foreground">A tailored 10-question quiz</p></div><ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link></div>
        </section>
      </div>}
    </div>
  </AppShell>;
}

function TopicRow({ topic, index, total }: { topic: { name: string; masteryLevel: string; masteryScore: number }; index: number; total: number }) {
  const complete = topic.masteryLevel === "proficient" || topic.masteryLevel === "mastered";
  const current = !complete && (topic.masteryLevel === "learning" || topic.masteryLevel === "developing");
  const statusLabel =
    topic.masteryLevel === "mastered"
      ? "Mastered"
      : topic.masteryLevel === "proficient"
        ? "Solid foundation"
        : topic.masteryLevel === "developing"
          ? "Building up"
          : topic.masteryLevel === "learning"
            ? "Recommended next"
            : "Not started";
  return <div className="relative flex gap-4 pb-5 last:pb-0"><div className="relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card bg-card">{complete ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span> : current ? <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-accent bg-accent/25"><span className="h-2 w-2 rounded-full bg-primary" /></span> : <span className="h-2 w-2 rounded-full bg-border" />}</div>{index < total - 1 && <div className={`absolute left-[13px] top-7 h-full w-px ${complete ? "bg-primary/40" : "bg-border"}`} />}<div className={`flex-1 rounded-2xl border p-3.5 transition-colors ${current ? "border-accent/40 bg-accent/10" : "border-transparent bg-secondary/50"}`}><div className="flex items-center justify-between gap-3"><div><p className={`text-[13px] font-semibold ${current ? "text-primary" : complete ? "text-primary" : "text-muted-foreground"}`}>{topic.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{statusLabel}</p></div>{current && <span className="rounded-full bg-accent px-2 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-wider text-accent-foreground">Now</span>}</div></div></div>;
}

function formatDate(date: string) {
  if (!date) return "soon";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  // Construct in local time from the y/m/d parts directly — `new Date(dateString)`
  // parses "YYYY-MM-DD" as UTC midnight, which renders as the previous day in any
  // timezone behind UTC once toLocaleDateString applies the local offset.
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}