import { Award, BookOpen, Brain, CalendarDays, ChevronRight, LayoutDashboard, Library, ListChecks, LogOut, Menu, Plus, Settings, Sparkles, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { getGetFeaturesQueryKey, getGetProfileQueryKey, useGetFeatures, useGetProfile } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/", label: "Today", icon: LayoutDashboard, comingSoonIfDisabled: false },
  { href: "/course", label: "Course workspace", icon: Library, comingSoonIfDisabled: false },
  { href: "/tutor", label: "Ask your tutor", icon: Brain, comingSoonIfDisabled: true },
  { href: "/quiz", label: "Adaptive quiz", icon: ListChecks, comingSoonIfDisabled: false },
  { href: "/achievements", label: "Achievements", icon: Award, comingSoonIfDisabled: false },
];

export function BrandMark() {
  return (
    <div className="flex items-center gap-3" data-testid="brand-study-coach">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[13px] bg-accent text-accent-foreground shadow-sm">
        <BookOpen className="h-[18px] w-[18px]" strokeWidth={2.5} />
        <span className="absolute right-[6px] top-[6px] h-1.5 w-1.5 rounded-full bg-accent-foreground" />
      </div>
      <span className="font-display text-[19px] font-semibold tracking-[-0.02em]">study coach</span>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { signOut } = useAuth();
  // Shares its cache with every other page that calls useGetProfile(), so
  // this never triggers an extra request beyond what's already loaded.
  const profileQuery = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  // Shared with every other page that calls this — one extra cheap request
  // at most, never duplicated across the app.
  const featuresQuery = useGetFeatures({ query: { queryKey: getGetFeaturesQueryKey() } });
  const tutorEnabled = featuresQuery.data?.tutorEnabled ?? false;
  // Never fall back to the account email here — it's not meant to be
  // displayed, and doing so was the bug this replaced.
  const displayName = profileQuery.data?.fullName?.trim() || "Student";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";
  return (
    <div className="flex h-full flex-col px-5 py-6">
      <div className="mb-10 px-1"><BrandMark /></div>
      <p className="mb-3 px-3 font-mono-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">Your desk</p>
      <nav className="space-y-1" aria-label="Primary navigation">
        {navItems.map(({ href, label, icon: Icon, comingSoonIfDisabled }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          const comingSoon = comingSoonIfDisabled && !tutorEnabled;
          return (
            // Still a real link even when its feature is off — the point of
            // a flag is that flipping it back on needs no further changes,
            // and a route that vanishes here would be one more thing to undo.
            <Link key={href} href={href} onClick={onNavigate} data-testid={`link-nav-${label.toLowerCase().replaceAll(" ", "-")}`}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${active ? "bg-sidebar-accent text-sidebar-foreground shadow-[inset_3px_0_0_hsl(var(--accent))]" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"}`}>
              <Icon className={`h-[17px] w-[17px] ${active ? "text-accent" : "text-sidebar-foreground/50 group-hover:text-accent/80"}`} strokeWidth={active ? 2.3 : 1.8} />
              <span>{label}</span>
              {comingSoon && (
                <span className="ml-auto rounded-full bg-sidebar-foreground/10 px-2 py-0.5 font-mono-ui text-[9px] uppercase tracking-wider text-sidebar-foreground/50">Soon</span>
              )}
              {!comingSoon && active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-foreground/35" />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-9">
        <p className="mb-3 px-3 font-mono-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">Library</p>
        <Link href="/courses/new" onClick={onNavigate} data-testid="link-add-course"
          className="group flex items-center gap-3 rounded-xl border border-dashed border-sidebar-border px-3 py-3 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:border-accent/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sidebar-accent text-accent"><Plus className="h-3.5 w-3.5" /></span>
          Add a course
        </Link>
      </div>
      <div className="mt-auto">
        <div className="mb-5 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-accent"><Sparkles className="h-3.5 w-3.5" /><span className="font-mono-ui text-[10px] uppercase tracking-[0.14em]">Small steps</span></div>
          <p className="text-[12px] leading-relaxed text-sidebar-foreground/65">A little focused practice today makes tomorrow lighter.</p>
        </div>
        <div className="border-t border-sidebar-border pt-4">
          <Link href="/profile" onClick={onNavigate} data-testid="link-sidebar-profile"
            className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors ${location.startsWith("/profile") ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70"}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-foreground">{initials}</div>
            <div className="min-w-0"><p className="truncate text-[13px] font-semibold">{displayName}</p><p className="truncate text-[11px] text-sidebar-foreground/45">View profile</p></div>
          </Link>
          <div className="mt-2 flex items-center gap-1">
            <Link href="/settings" onClick={onNavigate} data-testid="link-sidebar-settings" title="Settings"
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${location.startsWith("/settings") ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"}`}>
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <button type="button" onClick={() => void signOut()} data-testid="button-sign-out" title="Sign out"
              className="ml-auto rounded-lg p-1.5 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[246px] border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <SidebarContent />
      </aside>
      <div className="lg:pl-[246px]">
        <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md sm:px-8 lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" data-testid="button-open-menu" className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><Menu className="h-5 w-5" /></button>
          <BrandMark />
          <Link href="/tutor" aria-label="Ask your tutor" data-testid="link-mobile-tutor" className="rounded-xl p-2 text-primary hover:bg-muted"><Brain className="h-5 w-5" /></Link>
        </header>
        {menuOpen && <div className="fixed inset-0 z-40 lg:hidden"><button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} data-testid="button-close-menu" className="absolute inset-0 bg-primary/25 backdrop-blur-[2px]" /><aside className="relative h-full w-[280px] bg-sidebar text-sidebar-foreground shadow-2xl"><button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} data-testid="button-dismiss-menu" className="absolute right-4 top-5 rounded-lg p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent"><X className="h-4 w-4" /></button><SidebarContent onNavigate={() => setMenuOpen(false)} /></aside></div>}
        <main className="mx-auto max-w-[1450px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
    <div><p className="mb-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">{eyebrow}</p><h1 className="font-display text-4xl font-semibold tracking-[-0.045em] text-primary sm:text-[44px]">{title}</h1>{description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>}</div>
    {action}
  </div>;
}

export function Button({ children, onClick, variant = "primary", type = "button", disabled = false, testId, className = "" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "accent"; type?: "button" | "submit"; disabled?: boolean; testId?: string; className?: string }) {
  const styles = { primary: "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/15", secondary: "border border-border bg-card text-primary hover:border-primary/30 hover:bg-secondary", ghost: "text-muted-foreground hover:bg-muted hover:text-primary", accent: "bg-accent text-accent-foreground hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/20" };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

export function StatPill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? "border-accent/30 bg-accent/20" : "border-border bg-card"}`}><p className="mb-1 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="font-display text-2xl font-semibold tracking-tight text-primary">{value}</p></div>;
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-secondary ${className}`} data-testid="loading-skeleton" />;
}

export function ErrorNotice({ onRetry, message = "We couldn't load this just now." }: { onRetry?: () => void; message?: string }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5" data-testid="status-error"><p className="text-sm font-semibold text-destructive">A small detour</p><p className="mt-1 text-sm text-muted-foreground">{message}</p>{onRetry && <Button onClick={onRetry} variant="secondary" testId="button-retry">Try again</Button>}</div>;
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return <div className={`h-2 overflow-hidden rounded-full bg-secondary ${className}`} aria-label={`${value}% complete`}><div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center" data-testid="status-empty"><div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/30 text-primary"><CalendarDays className="h-5 w-5" /></div><h3 className="font-display text-xl font-semibold text-primary">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}