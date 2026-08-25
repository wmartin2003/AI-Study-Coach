import { useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/app-shell";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName || undefined } },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          setLocation("/");
        } else {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("sign-in");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
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
          <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-accent text-primary shadow-sm">
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

          <form onSubmit={submit} className="mt-7 space-y-4" data-testid="form-auth">
            {mode === "sign-up" && (
              <div>
                <label className="block text-[13px] font-semibold text-primary" htmlFor="fullName">
                  Full name
                </label>
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Alex Morgan"
                  data-testid="input-full-name"
                  className="form-input mt-2"
                />
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
