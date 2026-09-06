import { Link } from "wouter";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { BrandMark } from "@/components/app-shell";

/**
 * DRAFT — not yet reviewed. The structure below is a placeholder for real
 * legal copy the app owner will write; every section is a stand-in for
 * content that needs to be checked (and likely reviewed by a lawyer) before
 * this page is treated as an actual privacy policy.
 */
export default function PrivacyPage() {
  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <header className="mx-auto flex max-w-[820px] items-center justify-between px-5 py-6 sm:px-8">
        <BrandMark />
        <Link href="/" data-testid="link-privacy-home" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      <main className="mx-auto max-w-[820px] px-5 pb-24 sm:px-8">
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5" data-testid="notice-privacy-draft">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Draft — not yet reviewed</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              This page lays out the structure of what a privacy policy needs to cover. The specifics below are
              placeholders, not final legal language — they haven't been reviewed by a lawyer and shouldn't be relied
              on as a real privacy policy yet.
            </p>
          </div>
        </div>

        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-primary">Privacy Policy (Draft)</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: not yet published.</p>

        <div className="mt-10 space-y-10">
          <Section title="What we collect">
            <p>Placeholder — to be filled in with the real, complete list. At minimum, today the app collects:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Account info: name and email address.</li>
              <li>Academic content you provide: course names, topics, syllabi, notes, and other documents you upload.</li>
              <li>Usage data: quiz answers, tutor conversations, study activity, and mastery/progress scores.</li>
            </ul>
          </Section>

          <Section title="Where it's stored">
            <p>
              Placeholder. Today: account and academic data is stored in Supabase (Postgres + file storage) under
              access controls scoped to each student's own account.
            </p>
          </Section>

          <Section title="How AI processing works">
            <p>
              Placeholder. Today: when you use the tutor, adaptive quizzes, or study guides, relevant excerpts of your
              uploaded documents and course data are sent to Anthropic (the maker of Claude) to generate a response.
              Anthropic processes that content to return the result; the specifics of retention and use on their end
              should be described here once confirmed.
            </p>
          </Section>

          <Section title="Who can see your data">
            <p>Placeholder — to describe who at the company (if anyone) can access student data, and under what circumstances.</p>
          </Section>

          <Section title="How to delete your account">
            <p>
              Today: Settings → Delete account permanently removes your account and all associated data (courses,
              documents, conversations, quizzes, and progress). This section should describe the real timeline and
              any data that persists after deletion (e.g. backups), once confirmed.
            </p>
          </Section>

          <Section title="Contact">
            <p>Placeholder — an email address or form for privacy questions and requests.</p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-primary">{title}</h2>
      <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
