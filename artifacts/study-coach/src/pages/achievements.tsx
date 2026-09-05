import { Atom, Award, BookOpen, Calculator, Dna, Globe2, Palette, ScrollText, Trophy } from "lucide-react";
import { useState } from "react";
import { getListAchievementsQueryKey, useListAchievements } from "@workspace/api-client-react";
import type { Achievement } from "@workspace/api-client-react";
import { AppShell, EmptyState, ErrorNotice, PageHeading, SkeletonBlock } from "@/components/app-shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SUBJECT_STYLES = [
  { icon: Dna, chart: "chart-2" },
  { icon: Calculator, chart: "chart-4" },
  { icon: Atom, chart: "chart-5" },
  { icon: ScrollText, chart: "chart-3" },
  { icon: Globe2, chart: "chart-1" },
  { icon: Palette, chart: "chart-2" },
  { icon: BookOpen, chart: "chart-4" },
] as const;

function subjectStyle(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return SUBJECT_STYLES[hash % SUBJECT_STYLES.length];
}

function formatDate(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function AchievementsPage() {
  const query = useListAchievements({ query: { queryKey: getListAchievementsQueryKey() } });
  const achievements = query.data ?? [];
  const [selected, setSelected] = useState<Achievement | null>(null);

  return (
    <AppShell>
      <div className="coach-rise">
        <PageHeading
          eyebrow="Your record"
          title="Achievements."
          description="A record of the courses you've seen through to the end."
        />
        {query.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonBlock className="h-[180px]" />
            <SkeletonBlock className="h-[180px]" />
            <SkeletonBlock className="h-[180px]" />
          </div>
        ) : query.isError ? (
          <ErrorNotice onRetry={() => query.refetch()} />
        ) : achievements.length === 0 ? (
          <EmptyState
            title="No badges yet"
            description="Complete a course from your course workspace and it'll earn a place here, with your final mastery and study record."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((achievement) => {
              const style = subjectStyle(achievement.courseName ?? achievement.title);
              const Icon = style.icon;
              return (
                <button
                  type="button"
                  key={achievement.id}
                  onClick={() => setSelected(achievement)}
                  data-testid={`card-achievement-${achievement.id}`}
                  className="group flex flex-col rounded-[22px] border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: `hsl(var(--${style.chart}) / 0.18)`,
                        color: `hsl(var(--${style.chart}))`,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-accent/25 px-2.5 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-wider text-primary">
                      <Trophy className="h-3 w-3" /> Completed
                    </span>
                  </div>
                  {achievement.courseCode && (
                    <p className="mt-4 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {achievement.courseCode}
                    </p>
                  )}
                  <h3 className="mt-1 font-display text-xl font-semibold leading-tight text-primary">{achievement.title}</h3>
                  <p className="mt-3 text-[12px] text-muted-foreground">Completed {formatDate(achievement.earnedAt)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="rounded-[24px]" data-testid="dialog-achievement-detail">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-semibold text-primary">{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selected.courseCode && (
                  <p className="font-mono-ui text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {selected.courseCode}
                  </p>
                )}
                <div className="flex items-center gap-2 text-primary">
                  <Award className="h-4 w-4 text-accent" />
                  <p className="text-[13px] font-semibold">Completed {formatDate(selected.earnedAt)}</p>
                </div>
                {selected.masteryAtCompletion !== null && selected.masteryAtCompletion !== undefined && (
                  <div className="rounded-2xl bg-secondary/60 p-4">
                    <p className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Mastery at completion
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-primary">
                      {selected.masteryAtCompletion}%
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
