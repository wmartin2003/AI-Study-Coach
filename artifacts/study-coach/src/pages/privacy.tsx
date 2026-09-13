import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/app-shell";

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
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-primary">Privacy</h1>
        <p className="mt-3 max-w-[600px] text-sm leading-relaxed text-muted-foreground">
          This is run independently, not by a company with a legal team — so instead of boilerplate, here's
          a plain description of what this app actually does with your data.
        </p>

        <div className="mt-10 space-y-10">
          <Section title="What's collected">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Account details: your name and email address.</li>
              <li>Anything you add about your courses: course names, topics, deadlines, and any documents you upload (syllabi, notes, slides).</li>
              <li>Your activity in the app: tutor conversations, quiz answers and results, and the mastery/progress scores calculated from them.</li>
            </ul>
          </Section>

          <Section title="Where it's stored">
            <p>
              In Supabase, a hosted Postgres database and file storage provider, in their Canada (Central) region.
              Every table is protected by database-level access rules, so the API only ever reads or writes rows
              belonging to your own account.
            </p>
          </Section>

          <Section title="How the AI features work">
            <p>
              When you use the tutor, adaptive quizzes, or study guides, relevant excerpts of your uploaded documents
              and course data are sent to Anthropic (the company behind Claude) to generate a response. Per
              Anthropic's API terms, that content is used only to generate your response — not to train their models.
            </p>
          </Section>

          <Section title="Who else sees it">
            <p>
              Nobody, by default. This data isn't sold, shared with advertisers, or used for anything besides running
              the app for you. The only outside parties involved are Supabase (hosting the database and files) and
              Anthropic (generating AI responses, as above).
            </p>
          </Section>

          <Section title="How long it's kept">
            <p>
              For as long as your account exists — there's no automatic deletion schedule beyond that today.
            </p>
          </Section>

          <Section title="Deleting your data">
            <p>
              Settings → Delete account permanently removes your account and everything tied to it — courses,
              documents, tutor conversations, quizzes, and progress — immediately. This can't be undone.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              This is run by one person, not a support team — reach out however you normally would (the same place
              you got your invite, or reply to any email from this app) with any question or deletion request.
            </p>
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
