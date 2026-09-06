import {
  ArrowRight,
  Award,
  BookMarked,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  FileText,
  GraduationCap,
  Lightbulb,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "wouter";
import {
  getGetDashboardQueryKey,
  getGetTopicStudyMaterialQueryKey,
  getGetTutorConversationQueryKey,
  getListCourseDocumentsQueryKey,
  getListCoursesQueryKey,
  getListEventsQueryKey,
  useArchiveCourse,
  useCompleteCourse,
  useCompleteTopicStudyMaterial,
  useConfirmExtraction,
  useCreateEvent,
  useDeleteDocument,
  useDeleteEvent,
  useExtractSyllabus,
  useGetTopicStudyMaterial,
  useListCourseDocuments,
  useListCourses,
  useListEvents,
  useReactivateCourse,
  useRegenerateTopicStudyMaterial,
  useUpdateDocument,
  useUpdateEvent,
} from "@workspace/api-client-react";
import type { Course, CourseEvent, CourseTopic, DocumentSummary, SyllabusExtraction } from "@workspace/api-client-react";
import { AppShell, Button, EmptyState, ErrorNotice, PageHeading, ProgressBar, SkeletonBlock } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query-client";
import { formatDate, getApiErrorMessage, isBudgetError } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

type StatusFilter = "active" | "completed" | "archived";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  syllabus: "Course outline",
  lecture: "Lecture",
  notes: "Notes",
  study_guide: "Study guide",
  other: "Other",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  exam: "Exam",
  midterm: "Midterm",
  final: "Final exam",
  assignment: "Assignment",
  quiz: "Quiz",
  project: "Project",
  other: "Other",
};

export default function CoursePage() {
  const courseQuery = useListCourses(undefined, { query: { queryKey: getListCoursesQueryKey() } });
  const allCourses = courseQuery.data ?? [];
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("course");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const courses = useMemo(() => allCourses.filter((c) => c.status === statusFilter), [allCourses, statusFilter]);

  useEffect(() => {
    if (!allCourses.length) return;
    if (requestedId && allCourses.some((course) => course.id === requestedId)) {
      if (selectedId !== requestedId) {
        setSelectedId(requestedId);
        const requested = allCourses.find((c) => c.id === requestedId);
        if (requested && requested.status !== statusFilter) setStatusFilter(requested.status as StatusFilter);
      }
    }
  }, [allCourses, requestedId, selectedId, statusFilter]);

  useEffect(() => {
    if (!courses.length) {
      setSelectedId(null);
      return;
    }
    if (!courses.some((c) => c.id === selectedId)) setSelectedId(courses[0].id);
  }, [courses, selectedId]);

  const selected = courses.find((course) => course.id === selectedId);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const topics = selected?.topics ?? [];

  const completeCourse = useCompleteCourse();
  const archiveCourse = useArchiveCourse();
  const reactivateCourse = useReactivateCourse();

  const invalidateCourses = () => queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });

  return (
    <AppShell>
      <div className="coach-rise">
        <PageHeading
          eyebrow="Course workspace"
          title={selected?.name || "Your courses"}
          description="A map of what you know, and the one thing worth touching next."
          action={
            <Link
              href="/courses/new"
              data-testid="link-course-new"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-primary transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <Plus className="h-4 w-4" /> Add course
            </Link>
          }
        />
        {courseQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[.75fr_1.25fr]">
            <SkeletonBlock className="h-[520px]" />
            <SkeletonBlock className="h-[520px]" />
          </div>
        ) : courseQuery.isError && !courseQuery.data ? (
          <ErrorNotice onRetry={() => courseQuery.refetch()} />
        ) : allCourses.length === 0 ? (
          <EmptyState
            title="Your desk is ready"
            description="Add your first course and we'll turn it into a focused path."
            action={
              <Link href="/courses/new" data-testid="link-empty-course">
                <Button>
                  <Plus className="h-4 w-4" /> Add a course
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[.72fr_1.28fr]">
            <aside className="space-y-4">
              <div className="rounded-[22px] border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">My courses</p>
                  <BookMarked className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mb-4 flex gap-1 rounded-xl bg-secondary/60 p-1">
                  {(["active", "completed", "archived"] as StatusFilter[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      data-testid={`button-filter-${status}`}
                      className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                        statusFilter === status ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                {courses.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[12px] text-muted-foreground">No {statusFilter} courses.</p>
                ) : (
                  <div className="space-y-2">
                    {courses.map((course) => (
                      <button
                        type="button"
                        onClick={() => setSelectedId(course.id)}
                        key={course.id}
                        data-testid={`button-course-${course.id}`}
                        className={`w-full rounded-2xl border p-3 text-left transition-all ${
                          selected?.id === course.id ? "border-primary/25 bg-secondary shadow-sm" : "border-transparent hover:border-border hover:bg-secondary/60"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${selected?.id === course.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            <GraduationCap className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-primary">{course.name}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {course.progress}% mapped{course.completionDate ? ` · ${formatDate(course.completionDate)}` : ""}
                            </p>
                          </div>
                          {selected?.id === course.id && <ChevronDown className="mt-1 h-4 w-4 text-primary" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-[22px] bg-sidebar p-5 text-sidebar-foreground">
                <div className="mb-4 flex items-center gap-2 text-accent">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em]">Coach's note</span>
                </div>
                <p className="font-display text-[21px] font-semibold leading-tight">You don't need to cover everything today.</p>
                <p className="mt-3 text-[12px] leading-relaxed text-sidebar-foreground/60">Follow the path on the right. It is shaped around your recent answers.</p>
              </div>
            </aside>

            {!selected ? (
              <EmptyState
                title={`No ${statusFilter} courses`}
                description={statusFilter === "active" ? "Add a course to get started, or check completed/archived above." : "Nothing here yet."}
              />
            ) : (
              <section className="rounded-[22px] border border-border bg-card p-5 sm:p-7">
                {selected.isSample && (
                  <div className="mb-6 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-[12px] text-primary" data-testid="banner-sample-course-detail">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span>This is an example course. Add your real one, then archive this whenever you're ready.</span>
                  </div>
                )}
                <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-start">
                  <div>
                    <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Your path</p>
                    <h2 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-primary">{selected.name}</h2>
                    {(selected.courseCode || selected.institution || selected.instructor || selected.term) && (
                      <p className="mt-1.5 text-[12px] text-muted-foreground">
                        {[selected.courseCode, selected.institution, selected.instructor, selected.term].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="min-w-[140px]">
                    <div className="mb-2 flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Overall</span>
                      <span className="font-mono-ui font-semibold text-primary">{selected.progress}%</span>
                    </div>
                    <ProgressBar value={selected.progress} />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span className="font-semibold text-primary">{topics.length} topic areas</span>
                    {selected.completionDate && (
                      <>
                        <Circle className="h-1.5 w-1.5 fill-current" />
                        <span>Completion target {formatDate(selected.completionDate)}</span>
                      </>
                    )}
                    <Circle className="h-1.5 w-1.5 fill-current" />
                    <span>{selected.level}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {selected.status === "active" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmComplete(true)}
                          data-testid="button-complete-course"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-secondary"
                        >
                          <Award className="h-3.5 w-3.5" /> Mark completed
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveCourse.mutate({ courseId: selected.id }, { onSuccess: invalidateCourses })}
                          data-testid="button-archive-course"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary"
                        >
                          Archive
                        </button>
                      </>
                    )}
                    {selected.status !== "active" && (
                      <button
                        type="button"
                        onClick={() => reactivateCourse.mutate({ courseId: selected.id }, { onSuccess: invalidateCourses })}
                        data-testid="button-reactivate-course"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-secondary"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>

                <Tabs defaultValue={searchParams.get("tab") ?? "overview"} className="mt-7">
                  <TabsList className="h-auto flex-wrap justify-start gap-1 bg-secondary/60 p-1">
                    <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                    <TabsTrigger value="topics" data-testid="tab-topics">Topics</TabsTrigger>
                    <TabsTrigger value="materials" data-testid="tab-materials">Materials</TabsTrigger>
                    <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
                    <TabsTrigger value="practice" data-testid="tab-practice">Practice</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-6">
                    <OverviewTab course={selected} topics={topics} />
                  </TabsContent>

                  <TabsContent value="topics" className="mt-6">
                    <TopicsTab courseId={selected.id} topics={topics} autoOpenTopicName={searchParams.get("guide") === "1" ? searchParams.get("topic") : null} />
                  </TabsContent>

                  <TabsContent value="materials" className="mt-6">
                    <MaterialsTab courseId={selected.id} />
                  </TabsContent>

                  <TabsContent value="calendar" className="mt-6">
                    <CalendarTab courseId={selected.id} />
                  </TabsContent>

                  <TabsContent value="practice" className="mt-6">
                    <PracticeTab courseId={selected.id} topics={topics} />
                  </TabsContent>
                </Tabs>
              </section>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent className="rounded-[24px]" data-testid="dialog-confirm-complete">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-semibold text-primary">
              Mark {selected?.name} as completed?
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            This moves the course to your completed courses and adds a completion badge to your achievements. You can still
            access all its data, and reactivate it anytime.
          </p>
          <DialogFooter className="mt-2 flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmComplete(false)}
              className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <Button
              testId="button-confirm-complete"
              disabled={completeCourse.isPending}
              onClick={() =>
                selected &&
                completeCourse.mutate(
                  { courseId: selected.id },
                  {
                    onSuccess: () => {
                      invalidateCourses();
                      setConfirmComplete(false);
                    },
                  },
                )
              }
            >
              {completeCourse.isPending ? "Completing..." : "Mark completed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function OverviewTab({ course, topics }: { course: Course; topics: Course["topics"] }) {
  const eventsQuery = useListEvents({ courseId: course.id }, { query: { queryKey: getListEventsQueryKey({ courseId: course.id }) } });
  const upcoming = (eventsQuery.data ?? []).slice(0, 4);
  const weakTopics = [...topics].sort((a, b) => a.masteryScore - b.masteryScore).slice(0, 3);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-border p-4">
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Upcoming deadlines</p>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">No deadlines on the calendar yet.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {upcoming.map((event) => (
              <div key={event.id} className="flex items-center justify-between text-[12px]">
                <span className="text-primary">{event.title}</span>
                <span className="text-muted-foreground">{formatDate(event.eventDate)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-border p-4">
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Weakest areas</p>
        {weakTopics.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">No topics yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {weakTopics.map((topic) => (
              <div key={topic.name}>
                <div className="flex justify-between text-[12px]"><span className="text-primary">{topic.name}</span><span className="text-muted-foreground">{Math.round(topic.masteryScore)}%</span></div>
                <ProgressBar value={topic.masteryScore} className="mt-1.5 h-1.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicRow({
  topic,
  index,
  total,
  onOpen,
}: {
  topic: { name: string; masteryLevel: string; masteryScore: number };
  index: number;
  total: number;
  onOpen: () => void;
}) {
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
  return (
    <div className="relative flex gap-4 pb-5 last:pb-0">
      <div className="relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card bg-card">
        {complete ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>
        ) : current ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-accent bg-accent/25"><span className="h-2 w-2 rounded-full bg-primary" /></span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-border" />
        )}
      </div>
      {index < total - 1 && <div className={`absolute left-[13px] top-7 h-full w-px ${complete ? "bg-primary/40" : "bg-border"}`} />}
      <button
        type="button"
        onClick={onOpen}
        data-testid={`button-topic-${index}`}
        className={`group flex-1 rounded-2xl border p-3.5 text-left transition-colors ${current ? "border-accent/40 bg-accent/10 hover:bg-accent/15" : "border-transparent bg-secondary/50 hover:bg-secondary"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[13px] font-semibold ${current ? "text-primary" : complete ? "text-primary" : "text-muted-foreground"}`}>{topic.name}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{statusLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {current && <span className="rounded-full bg-accent px-2 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-wider text-accent-foreground">Now</span>}
            <span className="flex items-center gap-1 font-mono-ui text-[9px] font-semibold uppercase tracking-wider text-primary opacity-0 transition-opacity group-hover:opacity-100">
              <Sparkles className="h-3 w-3" /> Study guide
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topics tab — the learning path, plus an AI study guide per topic built
// from (and kept in sync with) the student's own uploaded course materials.
// ---------------------------------------------------------------------------

function TopicsTab({
  courseId,
  topics,
  autoOpenTopicName,
}: {
  courseId: string;
  topics: CourseTopic[];
  autoOpenTopicName?: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [activeTopic, setActiveTopic] = useState<CourseTopic | null>(null);
  const autoOpenedRef = useRef(false);

  // Lets a dashboard "Study guide: X" task deep-link straight into that
  // topic's guide instead of just landing on the Topics tab and leaving the
  // student to find it themselves. `topics` often arrives after the initial
  // render (still loading), so this keeps checking until it finds a match
  // rather than only trying once against an empty list — but only ever
  // auto-opens once, so it doesn't reopen after the student closes it.
  useEffect(() => {
    if (!autoOpenTopicName || autoOpenedRef.current || topics.length === 0) return;
    const match = topics.find((topic) => topic.name.toLowerCase() === autoOpenTopicName.toLowerCase());
    if (match) {
      setActiveTopic(match);
      autoOpenedRef.current = true;
    }
  }, [autoOpenTopicName, topics]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-topics"
        className="mb-3 flex w-full items-center justify-between text-left"
      >
        <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Learning path</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`} />
      </button>
      {expanded && (
        <div className="relative space-y-1 pl-1">
          {topics.map((topic, index) => (
            <TopicRow topic={topic} index={index} total={topics.length} key={topic.name} onOpen={() => setActiveTopic(topic)} />
          ))}
        </div>
      )}

      {activeTopic && (
        <TopicStudyGuideDialog courseId={courseId} topic={activeTopic} onClose={() => setActiveTopic(null)} />
      )}
    </div>
  );
}

function SourceBars({ sources }: { sources: { fileName: string; chunkCount: number }[] }) {
  const max = Math.max(...sources.map((s) => s.chunkCount), 1);
  return (
    <div className="space-y-2.5">
      {sources.map((source) => (
        <div key={source.fileName}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate font-semibold text-primary">{source.fileName}</span>
            <span className="shrink-0 text-muted-foreground">{source.chunkCount} {source.chunkCount === 1 ? "section" : "sections"}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(source.chunkCount / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches the daily-reset semantics used everywhere else in the plan — a
 * guide completed yesterday shouldn't read as permanently "done" forever. */
function isCompletedToday(completedAt: string | null): boolean {
  if (!completedAt) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return new Date(completedAt) >= todayStart;
}

function TopicStudyGuideDialog({
  courseId,
  topic,
  onClose,
}: {
  courseId: string;
  topic: CourseTopic;
  onClose: () => void;
}) {
  const queryKey = getGetTopicStudyMaterialQueryKey(courseId, topic.name);
  const materialQuery = useGetTopicStudyMaterial(courseId, topic.name, { query: { queryKey } });
  const regenerate = useRegenerateTopicStudyMaterial();
  const complete = useCompleteTopicStudyMaterial();
  const material = materialQuery.data;
  const done = isCompletedToday(material?.completedAt ?? null);

  const markDone = () => {
    if (!material) return;
    complete.mutate(
      { courseId, topicName: topic.name },
      {
        onSuccess: (result) => {
          queryClient.setQueryData(queryKey, { ...material, completedAt: result.completedAt });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast(
            result.xpAwarded > 0
              ? { title: "Study guide complete!", description: `+${result.xpAwarded} XP earned` }
              : { title: "Already marked done today", description: "Come back tomorrow for more XP." },
          );
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-[24px]" data-testid="dialog-study-guide">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold text-primary">{topic.name}</DialogTitle>
        </DialogHeader>

        {materialQuery.isLoading && (
          <div className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground" data-testid="status-study-guide-loading">
            <Loader2 className="h-4 w-4 animate-spin" /> Building your study guide...
          </div>
        )}

        {materialQuery.isError && (
          <ErrorNotice
            onRetry={() => materialQuery.refetch()}
            message={getApiErrorMessage(materialQuery.error, "Couldn't build a study guide just now.")}
          />
        )}

        {material && (
          <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1" data-testid="content-study-guide">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-wider ${
                  material.groundedInMaterials ? "bg-chart-2/15 text-chart-2" : "bg-muted text-muted-foreground"
                }`}
              >
                <Circle className="h-1.5 w-1.5 fill-current" />
                {material.groundedInMaterials ? "From your materials" : "General knowledge"}
              </span>
              <button
                type="button"
                onClick={() =>
                  regenerate.mutate(
                    { courseId, topicName: topic.name },
                    {
                      onSuccess: (updated) => queryClient.setQueryData(queryKey, updated),
                      onError: (err) =>
                        toast({
                          title: isBudgetError(err) ? "AI allowance reached" : "Couldn't regenerate",
                          description: getApiErrorMessage(err, "Couldn't build a study guide just now."),
                          variant: "destructive",
                        }),
                    },
                  )
                }
                disabled={regenerate.isPending}
                data-testid="button-regenerate-study-guide"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
              >
                <RotateCcw className={`h-3 w-3 ${regenerate.isPending ? "animate-spin" : ""}`} /> Regenerate
              </button>
            </div>

            <p className="text-[13px] leading-relaxed text-primary">{material.summary}</p>

            <div>
              <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Key points</p>
              <ul className="space-y-1.5">
                {material.keyPoints.map((point, index) => (
                  <li key={index} className="flex gap-2 text-[13px] leading-relaxed text-primary">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {material.keyTerms.length > 0 && (
              <div>
                <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Key terms</p>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-[12px]">
                    <tbody>
                      {material.keyTerms.map((term, index) => (
                        <tr key={index} className={index > 0 ? "border-t border-border" : ""}>
                          <td className="w-[36%] px-3 py-2 align-top font-semibold text-primary">{term.term}</td>
                          <td className="px-3 py-2 align-top text-muted-foreground">{term.definition}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {material.sources.length > 0 && (
              <div>
                <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Drawn from</p>
                <SourceBars sources={material.sources} />
              </div>
            )}

            <div className="rounded-2xl bg-accent/10 p-3.5">
              <p className="mb-1 flex items-center gap-1.5 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-primary">
                <Lightbulb className="h-3.5 w-3.5" /> Next step
              </p>
              <p className="text-[12px] leading-relaxed text-primary">{material.nextStep}</p>
            </div>

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Generated {formatDate(material.generatedAt)}. Upload more notes or lecture slides for this course and this
              updates automatically next time you open it.
            </p>
          </div>
        )}

        <DialogFooter className="mt-2 flex-row items-center justify-between gap-2 sm:justify-between">
          <Link href={`/tutor?course=${courseId}`} onClick={onClose} data-testid="link-study-guide-tutor" className="text-[12px] font-semibold text-primary hover:underline">
            Ask the tutor about this →
          </Link>
          <Button
            onClick={done ? onClose : markDone}
            disabled={complete.isPending || !material}
            variant={done ? "secondary" : "primary"}
            testId="button-complete-study-guide"
          >
            {complete.isPending ? "Saving..." : done ? <>Completed <Check className="h-3.5 w-3.5" /></> : "Mark as done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Materials tab
// ---------------------------------------------------------------------------

function MaterialsTab({ courseId }: { courseId: string }) {
  const docsQuery = useListCourseDocuments(courseId, { query: { queryKey: getListCourseDocumentsQueryKey(courseId) } });
  const documents = docsQuery.data ?? [];
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState("notes");
  const [reviewDoc, setReviewDoc] = useState<DocumentSummary | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingDoc, setDeletingDoc] = useState<DocumentSummary | null>(null);

  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCourseDocumentsQueryKey(courseId) });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const body = new FormData();
      body.append("file", file);
      body.append("courseId", courseId);
      body.append("documentType", documentType);
      await fetch("/api/documents", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
      invalidate();
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async (documentId: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const response = await fetch(`/api/documents/${documentId}/url`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return;
    const result = await response.json();
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-input bg-secondary/30 p-4 sm:flex-row sm:items-center">
        <select
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value)}
          data-testid="select-upload-type"
          className="form-input sm:w-[180px]"
        >
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:border-primary/30" data-testid="label-upload-material">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {uploading ? "Uploading..." : "Upload a file"}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="sr-only"
            data-testid="input-upload-material"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {docsQuery.isLoading ? (
        <SkeletonBlock className="h-[160px]" />
      ) : documents.length === 0 ? (
        <EmptyState title="No materials yet" description="Upload your course outline, lecture notes, or study guides here." />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 rounded-2xl border border-border p-3.5" data-testid={`row-document-${doc.id}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/25 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                {renamingId === doc.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        updateDocument.mutate({ documentId: doc.id, data: { fileName: renameValue } }, { onSuccess: invalidate });
                        setRenamingId(null);
                      }
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => setRenamingId(null)}
                    className="form-input py-1 text-[13px]"
                    data-testid={`input-rename-${doc.id}`}
                  />
                ) : (
                  <p className="truncate text-[13px] font-semibold text-primary">{doc.fileName}</p>
                )}
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}</span>
                  <Circle className="h-1 w-1 fill-current" />
                  <span>{new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <Circle className="h-1 w-1 fill-current" />
                  <StatusLabel status={doc.status} />
                </p>
              </div>
              <div className="flex items-center gap-1">
                {doc.status === "ready" && doc.documentType === "syllabus" && (
                  <SyllabusReviewButton documentId={doc.id} onOpen={() => setReviewDoc(doc)} />
                )}
                {doc.status === "ready" && (
                  <button type="button" onClick={() => openDocument(doc.id)} data-testid={`button-open-${doc.id}`} title="Open" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary">
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(doc.id);
                    setRenameValue(doc.fileName);
                  }}
                  data-testid={`button-rename-${doc.id}`}
                  title="Rename"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingDoc(doc)}
                  data-testid={`button-delete-${doc.id}`}
                  title="Delete"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewDoc && (
        <SyllabusReviewDialog
          documentId={reviewDoc.id}
          onClose={() => setReviewDoc(null)}
          onApplied={() => {
            setReviewDoc(null);
            invalidate();
            queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListEventsQueryKey({ courseId }) });
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deletingDoc}
        itemLabel={deletingDoc?.fileName ?? ""}
        pending={deleteDocument.isPending}
        onCancel={() => setDeletingDoc(null)}
        onConfirm={() => {
          if (!deletingDoc) return;
          deleteDocument.mutate({ documentId: deletingDoc.id }, { onSuccess: invalidate, onSettled: () => setDeletingDoc(null) });
        }}
      />
    </div>
  );
}

function ConfirmDeleteDialog({
  open,
  itemLabel,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean;
  itemLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="rounded-[24px]" data-testid="dialog-confirm-delete">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold text-primary">Delete this?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {'"'}
          {itemLabel}
          {'"'} will be permanently deleted. This can't be undone.
        </p>
        <DialogFooter className="mt-2 flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} testId="button-cancel-delete">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={pending}
            testId="button-confirm-delete"
            className="!bg-destructive !text-destructive-foreground hover:!shadow-destructive/20"
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusLabel({ status }: { status: string }) {
  if (status === "processing") return <span className="flex items-center gap-1 text-accent-foreground/70"><Loader2 className="h-3 w-3 animate-spin" /> Processing</span>;
  if (status === "failed") return <span className="text-destructive">Couldn't process</span>;
  return <span className="flex items-center gap-1 text-chart-2"><CheckCircle2 className="h-3 w-3" /> Ready</span>;
}

function SyllabusReviewButton({ documentId, onOpen }: { documentId: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={`button-review-${documentId}`}
      title="Review extracted info"
      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
}

function ConfidenceDot({ confidence }: { confidence: string }) {
  const color = confidence === "high" ? "bg-chart-2" : confidence === "medium" ? "bg-accent" : "bg-muted-foreground/50";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} title={`${confidence} confidence`} />;
}

function SyllabusReviewDialog({ documentId, onClose, onApplied }: { documentId: string; onClose: () => void; onApplied: () => void }) {
  const extractSyllabus = useExtractSyllabus();
  const confirmExtraction = useConfirmExtraction();
  const [extraction, setExtraction] = useState<SyllabusExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    extractSyllabus.mutate(
      { documentId },
      {
        onSuccess: (result) => setExtraction(result),
        onError: () => setError("We couldn't read this document. You can still add topics and dates manually."),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-[24px]" data-testid="dialog-syllabus-review">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold text-primary">We found the following</DialogTitle>
        </DialogHeader>
        {extractSyllabus.isPending && (
          <div className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your document...
          </div>
        )}
        {error && <ErrorNotice message={error} />}
        {extraction && (
          <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
            {extraction.confidence === "low" && (
              <p className="rounded-xl bg-accent/15 px-3 py-2 text-[12px] text-primary">
                We're not very confident about this extraction — please double check everything below before confirming.
              </p>
            )}
            <div>
              <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Topics</p>
              <div className="space-y-2">
                {extraction.topics.map((topic, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ConfidenceDot confidence={topic.confidence} />
                    <input
                      value={topic.name}
                      onChange={(event) => {
                        const topics = [...extraction.topics];
                        topics[index] = { ...topics[index], name: event.target.value };
                        setExtraction({ ...extraction, topics });
                      }}
                      className="form-input flex-1 py-1.5 text-[12px]"
                      data-testid={`input-extracted-topic-${index}`}
                    />
                    <button type="button" onClick={() => setExtraction({ ...extraction, topics: extraction.topics.filter((_, i) => i !== index) })} aria-label="Remove topic" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setExtraction({ ...extraction, topics: [...extraction.topics, { name: "", confidence: "high" }] })}
                  className="text-[11px] font-semibold text-primary hover:underline"
                  data-testid="button-add-extracted-topic"
                >
                  + Add topic
                </button>
              </div>
            </div>
            <div>
              <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Dates</p>
              <div className="space-y-2">
                {extraction.events.map((eventItem, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ConfidenceDot confidence={eventItem.confidence} />
                    <select
                      value={eventItem.type}
                      onChange={(event) => {
                        const events = [...extraction.events];
                        events[index] = { ...events[index], type: event.target.value as typeof eventItem.type };
                        setExtraction({ ...extraction, events });
                      }}
                      className="form-input w-[110px] py-1.5 text-[11px]"
                    >
                      {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <input
                      value={eventItem.title}
                      onChange={(event) => {
                        const events = [...extraction.events];
                        events[index] = { ...events[index], title: event.target.value };
                        setExtraction({ ...extraction, events });
                      }}
                      className="form-input flex-1 py-1.5 text-[12px]"
                      placeholder="Title"
                    />
                    <input
                      type="date"
                      value={eventItem.eventDate ?? ""}
                      onChange={(event) => {
                        const events = [...extraction.events];
                        events[index] = { ...events[index], eventDate: event.target.value || null };
                        setExtraction({ ...extraction, events });
                      }}
                      className="form-input w-[150px] py-1.5 text-[12px]"
                    />
                    <button type="button" onClick={() => setExtraction({ ...extraction, events: extraction.events.filter((_, i) => i !== index) })} aria-label="Remove date" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {extraction.events.some((e) => !e.eventDate) && (
                  <p className="text-[11px] text-muted-foreground">Items without a date won't be added to your calendar unless you set one.</p>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setExtraction({ ...extraction, events: [...extraction.events, { type: "other", title: "", eventDate: null, confidence: "high" }] })
                  }
                  className="text-[11px] font-semibold text-primary hover:underline"
                  data-testid="button-add-extracted-event"
                >
                  + Add date
                </button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="mt-2 flex-row justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          {extraction && (
            <Button
              testId="button-confirm-extraction"
              disabled={confirmExtraction.isPending}
              onClick={() =>
                confirmExtraction.mutate(
                  { documentId, data: extraction },
                  { onSuccess: onApplied },
                )
              }
            >
              {confirmExtraction.isPending ? "Applying..." : "Confirm & apply"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Calendar tab
// ---------------------------------------------------------------------------

type EventFormState = { type: string; title: string; eventDate: string; description: string };
const EMPTY_EVENT_FORM: EventFormState = { type: "exam", title: "", eventDate: "", description: "" };

function CalendarTab({ courseId }: { courseId: string }) {
  const eventsQuery = useListEvents({ courseId }, { query: { queryKey: getListEventsQueryKey({ courseId }) } });
  const events = eventsQuery.data ?? [];
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const [form, setForm] = useState<EventFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CourseEvent | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListEventsQueryKey({ courseId }) });

  const startAdd = () => {
    setEditingId(null);
    setForm(EMPTY_EVENT_FORM);
  };

  const startEdit = (event: CourseEvent) => {
    setEditingId(event.id);
    setForm({ type: event.type, title: event.title, eventDate: event.eventDate, description: event.description ?? "" });
  };

  const submit = () => {
    if (!form || !form.title.trim() || !form.eventDate) return;
    const payload = { courseId, type: form.type as CourseEvent["type"], title: form.title, eventDate: form.eventDate, description: form.description || undefined };
    if (editingId) {
      updateEvent.mutate({ eventId: editingId, data: payload }, { onSuccess: () => { invalidate(); setForm(null); } });
    } else {
      createEvent.mutate({ data: payload }, { onSuccess: () => { invalidate(); setForm(null); } });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Exams, assignments & deadlines</p>
        {!form && (
          <button type="button" onClick={startAdd} data-testid="button-add-event" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add event
          </button>
        )}
      </div>

      {form && (
        <div className="space-y-3 rounded-2xl border border-border bg-secondary/30 p-4" data-testid="form-event">
          <div className="grid gap-3 sm:grid-cols-[130px_1fr_150px]">
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="form-input">
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="e.g. Midterm exam"
              className="form-input"
              data-testid="input-event-title"
            />
            <input type="date" value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} className="form-input" data-testid="input-event-date" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded-xl px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted">
              Cancel
            </button>
            <Button testId="button-save-event" onClick={submit} disabled={!form.title.trim() || !form.eventDate || createEvent.isPending || updateEvent.isPending}>
              {editingId ? "Save changes" : "Add event"}
            </Button>
          </div>
        </div>
      )}

      {eventsQuery.isLoading ? (
        <SkeletonBlock className="h-[140px]" />
      ) : events.length === 0 && !form ? (
        <EmptyState title="Nothing on the calendar" description="Add exams, assignments, and other deadlines to keep track of what's coming up." />
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-center gap-3 rounded-2xl border border-border p-3.5" data-testid={`row-event-${event.id}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/25 text-primary">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-primary">{event.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {EVENT_TYPE_LABELS[event.type] ?? event.type} · {formatDate(event.eventDate)}
                  {event.source === "syllabus" ? " · From your course outline" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => startEdit(event)} title="Edit" data-testid={`button-edit-event-${event.id}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingEvent(event)}
                  title="Delete"
                  data-testid={`button-delete-event-${event.id}`}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deletingEvent}
        itemLabel={deletingEvent?.title ?? ""}
        pending={deleteEvent.isPending}
        onCancel={() => setDeletingEvent(null)}
        onConfirm={() => {
          if (!deletingEvent) return;
          deleteEvent.mutate({ eventId: deletingEvent.id }, { onSuccess: invalidate, onSettled: () => setDeletingEvent(null) });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practice tab
// ---------------------------------------------------------------------------

function PracticeTab({ courseId, topics }: { courseId: string; topics: CourseTopic[] }) {
  const [activeTopic, setActiveTopic] = useState<CourseTopic | null>(null);

  // Same "what to focus on" logic as the timeline's "Now" marker: the topic
  // already in progress, else the next not-started one, else whatever's
  // first (every topic is mastered) — always something to open, never a
  // dead-looking card.
  const recommended =
    topics.find((t) => t.masteryLevel === "learning" || t.masteryLevel === "developing") ??
    topics.find((t) => t.masteryLevel === "not_started") ??
    topics[0];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`/tutor?course=${courseId}`} data-testid="link-course-tutor" className="flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:border-primary/30 hover:bg-secondary">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-primary">
            <Search className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-primary">Study with tutor</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Ask about any topic</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
        <Link href={`/quiz?course=${courseId}`} data-testid="link-course-quiz" className="flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:border-primary/30 hover:bg-secondary">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-primary">
            <Play className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-primary">Test your recall</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">A tailored 10-question quiz</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
        {recommended && (
          <button
            type="button"
            onClick={() => setActiveTopic(recommended)}
            data-testid="button-course-study-guide"
            className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary/30 hover:bg-secondary sm:col-span-2"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-primary">Study guide</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Key points, terms & sources for {recommended.name}</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      </div>

      {activeTopic && (
        <TopicStudyGuideDialog courseId={courseId} topic={activeTopic} onClose={() => setActiveTopic(null)} />
      )}
    </>
  );
}

