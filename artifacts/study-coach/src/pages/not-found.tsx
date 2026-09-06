import { ArrowRight, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[420px] text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
          <Compass className="h-6 w-6" />
        </div>
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary/60">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-primary">
          This page wandered off.
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          There's nothing here — the link might be old, or the address might have a typo.
        </p>
        <Link
          href="/"
          data-testid="link-not-found-home"
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/15"
        >
          Back to your desk <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
