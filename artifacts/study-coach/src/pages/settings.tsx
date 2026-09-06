import { useState } from "react";
import { useLocation, Link } from "wouter";
import { AlertTriangle, ArrowRight, Check, KeyRound, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { getGetProfileQueryKey, useDeleteAccount, useGetProfile, useUpdateProfile } from "@workspace/api-client-react";
import { AppShell, Button, ErrorNotice, PageHeading, SkeletonBlock } from "@/components/app-shell";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query-client";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
      <p className="mb-4 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}

function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <SettingsSection title="Appearance">
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            data-testid={`button-theme-${value}`}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[12px] font-semibold transition-colors ${
              preference === value ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </SettingsSection>
  );
}

function PersonalizationSection() {
  const profileQuery = useGetProfile();
  const updateProfile = useUpdateProfile();
  const enabled = profileQuery.data?.personalizationEnabled !== false;

  return (
    <SettingsSection title="AI & personalization">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-primary">Personalize the tutor with your profile</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            When on, the tutor sees your name, education level, institution, and program so it can pitch explanations
            at the right depth. When off, it still uses whatever course you're actively studying, but nothing from
            your stored profile.
          </p>
        </div>
        <Switch
          checked={enabled}
          data-testid="switch-personalization"
          onCheckedChange={(next) =>
            updateProfile.mutate(
              { data: { personalizationEnabled: next } },
              { onSuccess: (profile) => queryClient.setQueryData(getGetProfileQueryKey(), profile) },
            )
          }
          disabled={profileQuery.isLoading || updateProfile.isPending}
          className="shrink-0"
        />
      </div>
    </SettingsSection>
  );
}

function AccountSection() {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const changePassword = async () => {
    if (password.length < 8) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      return;
    }
    setStatus("saved");
    setPassword("");
    setTimeout(() => {
      setShowPasswordForm(false);
      setStatus("idle");
    }, 1500);
  };

  return (
    <SettingsSection title="Account">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-primary">Signed in as</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{user?.email}</p>
          </div>
          <Link href="/profile" data-testid="link-settings-profile" className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
            Edit profile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="border-t border-border pt-4">
          {!showPasswordForm ? (
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              data-testid="button-change-password"
              className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"
            >
              <KeyRound className="h-3.5 w-3.5" /> Change password
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-[12px] font-semibold text-primary" htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="form-input"
                data-testid="input-new-password"
              />
              {status === "error" && <p className="text-[11px] font-semibold text-destructive">Password must be at least 8 characters, or something went wrong. Try again.</p>}
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={changePassword} disabled={status === "saving"} testId="button-save-password">
                  {status === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === "saved" ? <Check className="h-3.5 w-3.5" /> : null}
                  {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save password"}
                </Button>
                <button type="button" onClick={() => { setShowPasswordForm(false); setStatus("idle"); setPassword(""); }} className="text-[12px] font-semibold text-muted-foreground hover:text-primary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => { void signOut(); setLocation("/login"); }}
            data-testid="button-settings-logout"
            className="text-[12px] font-semibold text-muted-foreground hover:text-destructive"
          >
            Log out
          </button>
        </div>
      </div>
    </SettingsSection>
  );
}

function PrivacySection() {
  return (
    <SettingsSection title="Privacy & data">
      <div className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
        <p>Here's what's stored and how it's used:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Your profile, courses, topics, quiz history, and calendar are stored in your own private database rows — other students can never see them.</li>
          <li>Documents you upload are stored privately and are only readable by your own account.</li>
          <li>When you message the tutor, relevant context (the course you're studying, your mastery, and snippets of your own uploaded material) is sent to Anthropic's Claude API to generate a response. Nothing from any other student is ever included.</li>
          <li>Turning off personalization above stops your profile details specifically from being sent to the AI — it doesn't delete anything already stored.</li>
        </ul>
      </div>
    </SettingsSection>
  );
}

function DangerZone() {
  const [, setLocation] = useLocation();
  const { signOut } = useAuth();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <section className="rounded-[22px] border border-destructive/25 bg-destructive/[.03] p-5 sm:p-6">
      <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-destructive">Danger zone</p>
      <p className="text-[13px] font-semibold text-primary">Delete your account</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Permanently deletes your account and everything tied to it — courses, documents, quiz history, and
        achievements. This can't be undone.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="button-open-delete-account"
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 px-4 py-2 text-[12px] font-semibold text-destructive hover:bg-destructive/10"
      >
        <AlertTriangle className="h-3.5 w-3.5" /> Delete account
      </button>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setConfirmText(""); }}>
        <DialogContent className="rounded-[24px]" data-testid="dialog-delete-account">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-semibold text-primary">Delete your account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes your account, every course, document, quiz result, and achievement. There is no
            way to undo this. Type <strong className="text-primary">DELETE</strong> to confirm.
          </p>
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="Type DELETE"
            className="form-input"
            data-testid="input-confirm-delete-account"
          />
          {deleteAccount.isError && <p className="text-[12px] font-semibold text-destructive">Couldn't delete your account just now. Please try again.</p>}
          <DialogFooter className="mt-2 flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} testId="button-cancel-delete-account">Cancel</Button>
            <Button
              variant="primary"
              disabled={!canDelete || deleteAccount.isPending}
              onClick={() => {
                deleteAccount.mutate(undefined, {
                  onSuccess: async () => {
                    await signOut();
                    setLocation("/login");
                  },
                });
              }}
              testId="button-confirm-delete-account"
              className="!bg-destructive !text-destructive-foreground"
            >
              {deleteAccount.isPending ? "Deleting..." : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function SettingsPage() {
  const profileQuery = useGetProfile();

  return (
    <AppShell>
      <div className="coach-rise">
        <PageHeading eyebrow="Your account" title="Settings." description="Account, personalization, and how your data is used." />
        {profileQuery.isLoading ? (
          <div className="max-w-2xl space-y-4">
            <SkeletonBlock className="h-[160px]" />
            <SkeletonBlock className="h-[120px]" />
          </div>
        ) : profileQuery.isError ? (
          <ErrorNotice onRetry={() => profileQuery.refetch()} />
        ) : (
          <div className="max-w-2xl space-y-6">
            <AccountSection />
            <PersonalizationSection />
            <AppearanceSection />
            <PrivacySection />
            <DangerZone />
          </div>
        )}
      </div>
    </AppShell>
  );
}
