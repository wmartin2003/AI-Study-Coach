import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { AppShell, Button, ErrorNotice, PageHeading, SkeletonBlock } from "@/components/app-shell";
import { CountrySelect } from "@/components/country-select";
import { InstitutionSelect, type InstitutionValue } from "@/components/institution-select";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";

type EducationLevel = "high_school" | "college" | "university" | "other";
const LEVEL_LABELS: Record<EducationLevel, string> = {
  high_school: "High school",
  college: "College",
  university: "University",
  other: "Other",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const profileQuery = useGetProfile();
  const updateProfile = useUpdateProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">("");
  const [institution, setInstitution] = useState<InstitutionValue | null>(null);
  const [degree, setDegree] = useState("");
  const [programMajor, setProgramMajor] = useState("");
  const [gradeYear, setGradeYear] = useState("");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [loadedFromServer, setLoadedFromServer] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [justSaved]);

  // Populate the form once, the first time real data arrives — after that
  // the fields are the user's own edits, not something to keep overwriting
  // every time the query refetches in the background.
  useEffect(() => {
    if (!profileQuery.data || loadedFromServer) return;
    const p = profileQuery.data;
    setFirstName(p.firstName ?? "");
    setLastName(p.lastName ?? "");
    setCountryCode(p.countryCode ?? null);
    setEducationLevel((p.educationLevel as EducationLevel) ?? "");
    setInstitution(
      p.institutionName
        ? { name: p.institutionName, countryCode: p.institutionCountryCode ?? null, website: p.institutionWebsite ?? null, domain: p.institutionDomain ?? null }
        : null,
    );
    setDegree(p.degree ?? "");
    setProgramMajor(p.programMajor ?? "");
    setGradeYear(p.gradeYear ?? "");
    setExpectedCompletionDate(p.expectedCompletionDate ?? "");
    setLoadedFromServer(true);
  }, [profileQuery.data, loadedFromServer]);

  const isSchool = educationLevel === "high_school";
  const isCollegeLevel = educationLevel === "college" || educationLevel === "university";

  const save = () => {
    if (!firstName.trim() || !lastName.trim()) return;
    updateProfile.mutate(
      {
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          countryCode: countryCode ?? undefined,
          educationLevel: educationLevel || undefined,
          institutionName: institution?.name ?? "",
          institutionCountryCode: institution?.countryCode ?? undefined,
          institutionWebsite: institution?.website ?? undefined,
          institutionDomain: institution?.domain ?? undefined,
          degree: degree || undefined,
          programMajor: programMajor || undefined,
          gradeYear: gradeYear || undefined,
          expectedCompletionDate: expectedCompletionDate || undefined,
        },
      },
      {
        onSuccess: (profile) => {
          queryClient.setQueryData(getGetProfileQueryKey(), profile);
          setJustSaved(true);
        },
      },
    );
  };

  return (
    <AppShell>
      <div className="coach-rise">
        <PageHeading eyebrow="Your account" title="Profile." description="What your coach knows about you — update it any time." />

        {profileQuery.isLoading ? (
          <div className="space-y-4">
            <SkeletonBlock className="h-[220px]" />
            <SkeletonBlock className="h-[280px]" />
          </div>
        ) : profileQuery.isError ? (
          <ErrorNotice onRetry={() => profileQuery.refetch()} />
        ) : (
          <div className="max-w-2xl space-y-6">
            <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
              <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Personal information</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[13px] font-semibold text-primary" htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="form-input mt-2"
                    data-testid="input-profile-first-name"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-primary" htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="form-input mt-2"
                    data-testid="input-profile-last-name"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-[13px] font-semibold text-primary">Email</label>
                <p className="form-input mt-2 bg-secondary/50 text-muted-foreground" data-testid="text-profile-email">
                  {user?.email ?? "—"}
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Email is tied to your sign-in and can't be changed here.
                </p>
              </div>
            </section>

            <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
              <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Education</p>

              <div className="mt-4">
                <label className="block text-[13px] font-semibold text-primary">Country</label>
                <div className="mt-2">
                  <CountrySelect value={countryCode} onChange={setCountryCode} testId="select-profile-country" />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[13px] font-semibold text-primary" htmlFor="educationLevel">Current education level</label>
                <select
                  id="educationLevel"
                  value={educationLevel}
                  onChange={(event) => setEducationLevel(event.target.value as EducationLevel)}
                  className="form-input mt-2"
                  data-testid="select-profile-education-level"
                >
                  <option value="">Prefer not to say</option>
                  {(Object.keys(LEVEL_LABELS) as EducationLevel[]).map((level) => (
                    <option key={level} value={level}>{LEVEL_LABELS[level]}</option>
                  ))}
                </select>
              </div>

              {(isSchool || isCollegeLevel) && (
                <div className="mt-4 space-y-4 rounded-2xl bg-secondary/50 p-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-primary">
                      {isSchool ? "School name" : "Institution name"}
                    </label>
                    <div className="mt-2">
                      <InstitutionSelect value={institution} countryCode={countryCode} onChange={setInstitution} testId="select-profile-institution" />
                    </div>
                  </div>

                  {isCollegeLevel && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[13px] font-semibold text-primary" htmlFor="degree">Degree</label>
                        <input id="degree" value={degree} onChange={(event) => setDegree(event.target.value)} placeholder="e.g. Bachelor of Science" className="form-input mt-2" data-testid="input-profile-degree" />
                      </div>
                      <div>
                        <label className="block text-[13px] font-semibold text-primary" htmlFor="programMajor">Program / major</label>
                        <input id="programMajor" value={programMajor} onChange={(event) => setProgramMajor(event.target.value)} placeholder="e.g. Computer Science" className="form-input mt-2" data-testid="input-profile-program" />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[13px] font-semibold text-primary" htmlFor="gradeYear">{isSchool ? "Grade" : "Current year"}</label>
                      <input id="gradeYear" value={gradeYear} onChange={(event) => setGradeYear(event.target.value)} placeholder={isSchool ? "e.g. 11th grade" : "e.g. 2nd year"} className="form-input mt-2" data-testid="input-profile-grade-year" />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-primary" htmlFor="expectedCompletionDate">{isSchool ? "Expected graduation" : "Expected completion"}</label>
                      <input id="expectedCompletionDate" type="date" value={expectedCompletionDate} onChange={(event) => setExpectedCompletionDate(event.target.value)} className="form-input mt-2" data-testid="input-profile-expected-completion" />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {updateProfile.isError && (
              <p className="text-[12px] font-semibold text-destructive" data-testid="text-profile-error">
                Couldn't save your profile. Please try again.
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={save}
                disabled={updateProfile.isPending || !firstName.trim() || !lastName.trim()}
                testId="button-save-profile"
              >
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {updateProfile.isPending ? "Saving..." : "Save changes"}
              </Button>
              {justSaved && !updateProfile.isPending && (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-chart-2" data-testid="text-profile-saved">
                  <CheckCircle2 className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
