import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Brain, Calendar, Check, FileUp, ListChecks, Mail, Sparkles, Target, Upload } from "lucide-react";
import { useJoinWaitlist } from "@workspace/api-client-react";
import { BrandMark, Button } from "@/components/app-shell";
import { getApiErrorMessage } from "@/lib/format";

export default function LandingPage() {
  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-6 sm:px-8">
        <BrandMark />
        <Link
          href="/login"
          data-testid="link-landing-sign-in"
          className="rounded-xl px-4 py-2 text-[13px] font-semibold text-primary hover:bg-secondary"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 pb-24 sm:px-8">
        <Hero />
        <Features />
        <HowItWorks />
        <WaitlistSection />
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-5 py-8 text-[12px] text-muted-foreground sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} AI Study Coach</span>
          <Link href="/privacy" data-testid="link-landing-privacy" className="font-semibold text-muted-foreground hover:text-primary">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="pt-10 text-center sm:pt-16">
      <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Closed beta
      </div>
      <h1 className="mx-auto max-w-[820px] font-display text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-primary sm:text-6xl">
        Upload your syllabus. Get a plan that covers <span className="text-accent">every</span> course.
      </h1>
      <p className="mx-auto mt-5 max-w-[560px] text-base leading-relaxed text-muted-foreground sm:text-lg">
        Most tools help you study one thing at a time. AI Study Coach reads what your courses actually
        assign, then tells you what to work on today — across all of them, prioritized by what's due soonest.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href="#waitlist" data-testid="link-hero-waitlist">
          <Button variant="accent" className="px-6 py-3.5 text-sm">
            Join the waitlist <ArrowRight className="h-4 w-4" />
          </Button>
        </a>
        <Link href="/login" data-testid="link-hero-sign-in" className="text-[13px] font-semibold text-muted-foreground hover:text-primary">
          Already have an invite code? Sign in →
        </Link>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Calendar,
      title: "A daily plan across every course",
      description:
        "Your coach looks at every course you're taking at once — deadlines, exams, and how solid your grasp of each topic is — and tells you what today's session should be. When a midterm is close, it moves to the top.",
    },
    {
      icon: Brain,
      title: "A tutor grounded in your own material",
      description:
        "Ask a question and it answers from the notes and slides you actually uploaded — not a generic guess at what your course might cover. When it hasn't seen something, it says so instead of making it up.",
    },
    {
      icon: ListChecks,
      title: "Quizzes that track mastery per topic",
      description:
        "Adaptive quizzes target the topics you're weakest on, and every answer updates a real mastery score per topic — so \"studying\" turns into a number that actually moves.",
    },
  ];

  return (
    <section className="mt-20 sm:mt-28">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-[24px] border border-border bg-card p-6">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/25 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold text-primary">{title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Add a course, upload the syllabus",
      description: "Drop in the PDF or doc your professor handed out. That's the only setup step.",
    },
    {
      icon: FileUp,
      title: "It extracts topics and dates",
      description: "Your coach reads the syllabus and pulls out the topic list, exams, and assignment dates for you to confirm.",
    },
    {
      icon: Target,
      title: "You get a plan that updates as you go",
      description: "Every quiz and study session feeds back into your plan, so it keeps pointing at what actually needs work.",
    },
  ];

  return (
    <section className="mt-20 rounded-[28px] bg-sidebar px-6 py-12 text-sidebar-foreground sm:mt-28 sm:px-12 sm:py-16">
      <div className="mb-10 text-center">
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">How it works</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Three steps, then it runs itself.</h2>
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, description }, index) => (
          <div key={title} className="relative">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-foreground/[.08] text-accent">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <span className="font-mono-ui text-[11px] text-sidebar-foreground/40">Step {index + 1}</span>
            </div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-sidebar-foreground/65">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinWaitlist = useJoinWaitlist();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    joinWaitlist.mutate(
      { data: { email } },
      {
        onSuccess: () => setSubmitted(true),
        onError: (err) => setError(getApiErrorMessage(err, "Something went wrong. Please try again.")),
      },
    );
  };

  return (
    <section id="waitlist" className="mx-auto mt-20 max-w-[560px] text-center sm:mt-28">
      <div className="mb-4 flex items-center justify-center gap-2 text-accent">
        <Sparkles className="h-4 w-4" />
        <span className="font-mono-ui text-[10px] uppercase tracking-[0.18em]">Currently in closed beta with students at UPEI</span>
      </div>
      <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-primary sm:text-4xl">
        Get on the list.
      </h2>
      <p className="mx-auto mt-3 max-w-[420px] text-sm leading-relaxed text-muted-foreground">
        We're letting students in gradually while we keep this good, not big. Leave your email and we'll send an invite
        when there's room.
      </p>

      {submitted ? (
        <div className="mt-7 flex items-center justify-center gap-2 rounded-2xl border border-chart-2/30 bg-chart-2/10 px-5 py-4 text-[13px] font-semibold text-primary" data-testid="status-waitlist-joined">
          <Check className="h-4 w-4 text-chart-2" /> You're on the list — we'll email you when it's your turn.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 flex flex-col gap-3 sm:flex-row" data-testid="form-waitlist">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@school.edu"
            data-testid="input-waitlist-email"
            className="form-input flex-1"
          />
          <Button type="submit" disabled={joinWaitlist.isPending} testId="button-join-waitlist" className="justify-center whitespace-nowrap">
            <Mail className="h-4 w-4" /> {joinWaitlist.isPending ? "Joining..." : "Join the waitlist"}
          </Button>
        </form>
      )}
      {error && (
        <p className="mt-3 text-[12px] text-destructive" data-testid="text-waitlist-error">
          {error}
        </p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        We'll only use this email to invite you when a spot opens up — it isn't shared with anyone else.
      </p>

      <p className="mt-10 text-[13px] text-muted-foreground">
        Already have a code?{" "}
        <Link href="/login" data-testid="link-waitlist-sign-in" className="font-semibold text-primary hover:underline">
          Sign in here
        </Link>
        .
      </p>
    </section>
  );
}
