import { useState } from "react";
import { useLocation, useSearchParams } from "wouter";
import { BookOpen, Mail } from "lucide-react";
import { getGetSignupConfigQueryKey, useGetSignupConfig, useSignup } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/app-shell";
import { getApiErrorMessage } from "@/lib/format";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signup = useSignup();
  // The API and frontend are deployed separately, so signup state (whether
  // it's open, whether it needs a code) comes from the API rather than
  // duplicating env vars across both hosts and risking them disagreeing.
  const configQuery = useGetSignupConfig({ query: { queryKey: getGetSignupConfigQueryKey() } });
  const requiresInviteCode = configQuery.data?.requiresInviteCode ?? false;
  // Default to "open" while the config is still loading — briefly showing
  // the form is a much smaller cost than briefly showing "signups are
  // closed" when they aren't.
  const signupOpen = configQuery.data?.open ?? true;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    try {
      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        setLocation("/");
      } else {
        // Accounts are created only by the server (POST /api/signup), never
        // by calling supabase.auth.signUp from the browser — the anon key is
        // public, so an invite-code check here would be bypassable. The
        // server verifies the code and creates the user with the service
        // role; we sign in with the same credentials right after.
        await signup.mutateAsync({
          data: { email, password, firstName, lastName, inviteCode: requiresInviteCode ? inviteCode : undefined },
        });
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          // Email confirmation may be required at the project level (a
          // manual Supabase dashboard setting, not this app's call) — that's
          // not a failure, just a step before the account is usable.
          if (signInError.message.toLowerCase().includes("email not confirmed")) {
            setNotice("Account created — check your email to confirm it, then sign in.");
            setMode("sign-in");
            return;
          }
          throw signInError;
        }
        setLocation("/onboarding");
      }
    } catch (err) {
      setError(getApiErrorMessage(err, err instanceof Error ? err.message : "Something went wrong. Try again."));
    } finally {
      setPending(false);
    }
  };

  const forgotPassword = async () => {
    if (!email) {
      setError("Enter your email above first, then click \"Forgot password\".");
      return;
    }
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setNotice(resetError ? null : "Password reset email sent — check your inbox.");
    if (resetError) setError(resetError.message);
  };

  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center justify-center gap-3" data-testid="brand-study-coach">
          <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-accent text-accent-foreground shadow-sm">
            <BookOpen className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </div>
          <span className="font-display text-[19px] font-semibold tracking-[-0.02em] text-primary">study coach</span>
        </div>

        <div className="rounded-[24px] border border-border bg-card p-6 sm:p-8">
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary/60">
            {mode === "sign-in" ? "Welcome back" : "Get started"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-primary">
            {mode === "sign-in" ? "Ready to pick up where you left off?" : "Start your study path."}
          </h1>

          {mode === "sign-up" && !signupOpen ? (
            <div className="mt-7" data-testid="status-signup-closed">
              <p className="text-sm leading-relaxed text-muted-foreground">
                We've reached today's limit on new accounts. Join the waitlist and I'll open a spot for you.
              </p>
              <a
                href="/#waitlist"
                data-testid="link-signup-closed-waitlist"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/15"
              >
                <Mail className="h-4 w-4" /> Join the waitlist
              </a>
            </div>
          ) : (
          <form onSubmit={submit} className="mt-7 space-y-4" data-testid="form-auth">
            {mode === "sign-up" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-primary" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Alex"
                    data-testid="input-first-name"
                    className="form-input mt-2"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-primary" htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Morgan"
                    data-testid="input-last-name"
                    className="form-input mt-2"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-[13px] font-semibold text-primary" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@school.edu"
                data-testid="input-email"
                className="form-input mt-2"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-primary" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                data-testid="input-password"
                className="form-input mt-2"
              />
            </div>
            {mode === "sign-up" && requiresInviteCode && (
              <div>
                <label className="block text-[13px] font-semibold text-primary" htmlFor="inviteCode">
                  Invite code
                </label>
                <input
                  id="inviteCode"
                  required
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="e.g. quiet-otter-4821"
                  data-testid="input-invite-code"
                  className="form-input mt-2"
                />
                <p className="mt-1.5 text-[12px] text-muted-foreground">We're in closed beta — you'll need a code from someone already in.</p>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-destructive/5 px-3 py-2 text-[12px] text-destructive" data-testid="text-auth-error">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-xl bg-chart-2/10 px-3 py-2 text-[12px] text-primary" data-testid="text-auth-notice">
                {notice}
              </p>
            )}

            <Button type="submit" disabled={pending} testId="button-submit-auth" className="w-full">
              <Mail className="h-4 w-4" />
              {pending ? "One moment..." : mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>

            {mode === "sign-in" && (
              <button
                type="button"
                onClick={forgotPassword}
                data-testid="button-forgot-password"
                className="w-full text-center text-[12px] font-semibold text-muted-foreground hover:text-primary"
              >
                Forgot password?
              </button>
            )}
          </form>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
            setNotice(null);
          }}
          data-testid="button-toggle-auth-mode"
          className="mt-5 w-full text-center text-[13px] font-medium text-muted-foreground hover:text-primary"
        >
          {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
