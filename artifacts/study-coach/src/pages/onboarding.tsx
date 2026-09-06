import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, BookOpen } from "lucide-react";
import { getGetProfileQueryKey, useUpdateProfile } from "@workspace/api-client-react";
import { Button } from "@/components/app-shell";
import { queryClient } from "@/lib/query-client";
import { CountrySelect } from "@/components/country-select";
import { InstitutionSelect, type InstitutionValue } from "@/components/institution-select";

type EducationLevel = "high_school" | "college" | "university" | "other";

const LEVEL_LABELS: Record<EducationLevel, string> = {
  high_school: "High school",
  college: "College",
  university: "University",
  other: "Other",
};

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const updateProfile = useUpdateProfile();
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">("");
  const [institution, setInstitution] = useState<InstitutionValue | null>(null);
  const [degree, setDegree] = useState("");
  const [programMajor, setProgramMajor] = useState("");
  const [gradeYear, setGradeYear] = useState("");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");

  const finish = (onboardingCompleted: boolean) => {
    updateProfile.mutate(
      {
        data: {
          onboardingCompleted,
          countryCode: countryCode || undefined,
          educationLevel: educationLevel || undefined,
          institutionName: institution?.name || undefined,
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
          // Write the response straight into the cache rather than just
          // invalidating: invalidate-then-navigate races the background
          // refetch, so the protected route below can still read the old
          // (onboardingCompleted: false) cached value on its first render
          // and bounce straight back here.
          queryClient.setQueryData(getGetProfileQueryKey(), profile);
          setLocation("/");
        },
        onError: () => setLocation("/"),
      },
    );
  };

  const isSchool = educationLevel === "high_school";
  const isCollegeLevel = educationLevel === "college" || educationLevel === "university";

  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[480px]">
        <div className="mb-8 flex items-center justify-center gap-3" data-testid="brand-study-coach">
          <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-accent text-accent-foreground shadow-sm">
            <BookOpen className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </div>
          <span className="font-display text-[19px] font-semibold tracking-[-0.02em] text-primary">study coach</span>
        </div>

        <div className="rounded-[24px] border border-border bg-card p-6 sm:p-8">
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-primary/60">A little about you</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-primary">
            Help your coach get it right.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This shapes how your tutor explains things — depth, examples, pacing. Everything here is optional.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              finish(true);
            }}
            className="mt-7 space-y-5"
            data-testid="form-onboarding"
          >
            <div>
              <label className="block text-[13px] font-semibold text-primary" htmlFor="country">
                Country
              </label>
              <div className="mt-2">
                <CountrySelect value={countryCode} onChange={setCountryCode} testId="select-country" />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-primary" htmlFor="educationLevel">
                Current education level
              </label>
              <select
                id="educationLevel"
                value={educationLevel}
                onChange={(event) => setEducationLevel(event.target.value as EducationLevel)}
                data-testid="select-education-level"
                className="form-input mt-2"
              >
                <option value="">Prefer not to say</option>
                {(Object.keys(LEVEL_LABELS) as EducationLevel[]).map((level) => (
                  <option key={level} value={level}>
                    {LEVEL_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>

            {isSchool && (
              <div className="space-y-5 rounded-2xl bg-secondary/50 p-4" data-testid="section-high-school-fields">
                <div>
                  <label className="block text-[13px] font-semibold text-primary">School name</label>
                  <div className="mt-2">
                    <InstitutionSelect
                      value={institution}
                      countryCode={countryCode}
                      onChange={setInstitution}
                      placeholder="e.g. Lincoln High School"
                      testId="select-institution"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-primary" htmlFor="gradeYear">
                      Grade
                    </label>
                    <input
                      id="gradeYear"
                      value={gradeYear}
                      onChange={(event) => setGradeYear(event.target.value)}
                      placeholder="e.g. 11th grade"
                      data-testid="input-grade-year"
                      className="form-input mt-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-primary" htmlFor="expectedCompletionDate">
                      Expected graduation
                    </label>
                    <input
                      id="expectedCompletionDate"
                      type="date"
                      value={expectedCompletionDate}
                      onChange={(event) => setExpectedCompletionDate(event.target.value)}
                      data-testid="input-expected-completion"
                      className="form-input mt-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {isCollegeLevel && (
              <div className="space-y-5 rounded-2xl bg-secondary/50 p-4" data-testid="section-college-fields">
                <div>
                  <label className="block text-[13px] font-semibold text-primary">Institution name</label>
                  <div className="mt-2">
                    <InstitutionSelect
                      value={institution}
                      countryCode={countryCode}
                      onChange={setInstitution}
                      placeholder="e.g. University of Toronto"
                      testId="select-institution"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-primary" htmlFor="degree">
                      Degree
                    </label>
                    <input
                      id="degree"
                      value={degree}
                      onChange={(event) => setDegree(event.target.value)}
                      placeholder="e.g. Bachelor of Science"
                      data-testid="input-degree"
                      className="form-input mt-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-primary" htmlFor="programMajor">
                      Program / major
                    </label>
                    <input
                      id="programMajor"
                      value={programMajor}
                      onChange={(event) => setProgramMajor(event.target.value)}
                      placeholder="e.g. Computer Science"
                      data-testid="input-program-major"
                      className="form-input mt-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-primary" htmlFor="gradeYear">
                      Current year
                    </label>
                    <input
                      id="gradeYear"
                      value={gradeYear}
                      onChange={(event) => setGradeYear(event.target.value)}
                      placeholder="e.g. 2nd year"
                      data-testid="input-grade-year"
                      className="form-input mt-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-primary" htmlFor="expectedCompletionDate">
                      Expected completion
                    </label>
                    <input
                      id="expectedCompletionDate"
                      type="date"
                      value={expectedCompletionDate}
                      onChange={(event) => setExpectedCompletionDate(event.target.value)}
                      data-testid="input-expected-completion"
                      className="form-input mt-2"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => finish(true)}
                data-testid="button-skip-onboarding"
                className="text-[13px] font-semibold text-muted-foreground hover:text-primary"
              >
                Skip for now
              </button>
              <Button type="submit" disabled={updateProfile.isPending} testId="button-finish-onboarding">
                {updateProfile.isPending ? "Saving..." : "Start studying"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
