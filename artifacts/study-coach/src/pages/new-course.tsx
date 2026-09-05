import { ArrowLeft, CalendarDays, Check, ChevronDown, CircleAlert, FileText, Info, UploadCloud } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, Link } from "wouter";
import { useCreateCourse } from "@workspace/api-client-react";
import type { CourseInput } from "@workspace/api-client-react";
import { AppShell, Button, ErrorNotice, PageHeading } from "@/components/app-shell";
import { Form } from "@/components/ui/form";
import { supabase } from "@/lib/supabase";

type UploadState = "idle" | "uploading" | "ready" | "failed";

export default function NewCoursePage() {
  const [, setLocation] = useLocation();
  const createCourse = useCreateCourse();
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("syllabus");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const form = useForm<CourseInput>({
    defaultValues: { name: "", completionDate: "", level: "Undergraduate", courseCode: "", institution: "", instructor: "", term: "" },
  });

  const submit = form.handleSubmit((values) =>
    createCourse.mutate(
      { data: values },
      {
        onSuccess: async (course) => {
          setCreatedCourseId(course.id);
          if (!file) {
            setLocation(`/course?course=${course.id}`);
            return;
          }
          setUploadState("uploading");
          try {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            const body = new FormData();
            body.append("file", file);
            body.append("courseId", course.id);
            body.append("documentType", documentType);
            const response = await fetch("/api/documents", {
              method: "POST",
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              body,
            });
            const result = response.ok ? await response.json() : null;
            if (result?.status === "ready") {
              setUploadState("ready");
              setLocation(`/course?course=${course.id}`);
            } else {
              setUploadState("failed");
            }
          } catch {
            setUploadState("failed");
          }
        },
      },
    ),
  );

  return (
    <AppShell>
      <div className="coach-rise">
        <PageHeading
          eyebrow="Course library"
          title="Make a new study path."
          description="Tell your coach where you're headed. You can add your notes after."
          action={
            <Link href="/course" data-testid="link-cancel-course" className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> Back to courses
            </Link>
          }
        />
        <div className="mx-auto grid max-w-[1000px] gap-6 lg:grid-cols-[1fr_330px]">
          <Form {...form}>
            <form onSubmit={submit} className="rounded-[24px] border border-border bg-card p-5 sm:p-8" data-testid="form-create-course">
              <div className="mb-8">
                <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Course details</p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-primary">Set the coordinates</h2>
              </div>
              <div className="space-y-5">
                <Field label="Course name" hint="What do you call this class?" error={form.formState.errors.name?.message}>
                  <input {...form.register("name", { required: "Give your course a name" })} placeholder="e.g. Computer Networks" data-testid="input-course-name" className="form-input" />
                </Field>
                <Field label="Expected completion date" hint="Optional — helps your coach pace your plan.">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input {...form.register("completionDate")} type="date" data-testid="input-completion-date" className="form-input pl-10" />
                  </div>
                </Field>
                <Field label="Your level" hint="This helps us set the right depth.">
                  <select {...form.register("level")} data-testid="select-course-level" className="form-input">
                    <option>Undergraduate</option>
                    <option>Graduate</option>
                    <option>High school</option>
                    <option>Professional certification</option>
                  </select>
                </Field>
              </div>

              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                data-testid="button-toggle-additional-details"
                className="mt-6 flex w-full items-center justify-between border-t border-border pt-5 text-left"
              >
                <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Additional details (optional)</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </button>
              {showDetails && (
                <div className="mt-5 grid gap-5 sm:grid-cols-2" data-testid="section-additional-details">
                  <Field label="Course code" hint="e.g. CS 301">
                    <input {...form.register("courseCode")} placeholder="CS 301" data-testid="input-course-code" className="form-input" />
                  </Field>
                  <Field label="Institution" hint="Where you're taking this.">
                    <input {...form.register("institution")} placeholder="e.g. University of Toronto" data-testid="input-institution" className="form-input" />
                  </Field>
                  <Field label="Instructor" hint="Your professor or teacher.">
                    <input {...form.register("instructor")} placeholder="e.g. Dr. Patel" data-testid="input-instructor" className="form-input" />
                  </Field>
                  <Field label="Term" hint="e.g. Fall 2026">
                    <input {...form.register("term")} placeholder="e.g. Fall 2026" data-testid="input-term" className="form-input" />
                  </Field>
                </div>
              )}

              {createCourse.isError && (
                <div className="mt-5">
                  <ErrorNotice message="We couldn't save this course. Your details are still here." />
                </div>
              )}
              <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Info className="h-3.5 w-3.5" /> You can change these later.
                </p>
                <Button type="submit" disabled={createCourse.isPending || uploadState === "uploading"} testId="button-save-course">
                  {createCourse.isPending ? "Building your path..." : uploadState === "uploading" ? "Reading your notes..." : "Create study path"} <Check className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
          <aside className="space-y-4">
            <div className="rounded-[24px] border border-border bg-card p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Optional</p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-primary">Bring your material</h3>
                </div>
                <UploadCloud className="h-5 w-5 text-primary" />
              </div>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                data-testid="select-course-document-type"
                className="form-input mb-3"
              >
                <option value="syllabus">Course outline / syllabus</option>
                <option value="notes">Notes</option>
                <option value="study_guide">Study guide</option>
                <option value="other">Other</option>
              </select>
              <label
                htmlFor="course-file"
                data-testid="label-upload-course"
                className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-input bg-secondary/35 px-5 py-8 text-center transition-colors hover:border-primary/40 hover:bg-secondary"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary shadow-sm transition-transform group-hover:-translate-y-0.5">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="mt-3 text-[12px] font-semibold text-primary">{fileName || "Upload notes or a syllabus"}</span>
                <span className="mt-1 text-[11px] text-muted-foreground">PDF, DOCX, or TXT · up to 20 MB</span>
                <input
                  id="course-file"
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setFile(selected);
                    setFileName(selected?.name || "");
                    setUploadState("idle");
                  }}
                  data-testid="input-course-file"
                  className="sr-only"
                />
              </label>
              {uploadState === "uploading" && (
                <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground" data-testid="status-upload-processing">
                  <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/40 border-t-primary coach-pulse" /> Reading your notes...
                </p>
              )}
              {uploadState === "failed" && (
                <div className="mt-4" data-testid="status-upload-failed">
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <CircleAlert className="h-3.5 w-3.5" /> We saved the file, but couldn't extract text from it yet.
                  </p>
                  <Link href={createdCourseId ? `/course?course=${createdCourseId}` : "/course"} data-testid="link-upload-continue" className="mt-2 inline-block text-[11px] font-semibold text-primary hover:underline">
                    Continue to your course →
                  </Link>
                </div>
              )}
              {uploadState === "idle" && (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  If this is your syllabus, we'll offer to pull out topics and dates for you to review once it's uploaded — from your course's Materials tab.
                </p>
              )}
            </div>
            <div className="rounded-[24px] bg-primary p-5 text-primary-foreground">
              <p className="font-display text-xl font-semibold leading-tight">A good plan starts small.</p>
              <p className="mt-2 text-[12px] leading-relaxed text-primary-foreground/60">Add the class now. You can build the rest as you go.</p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, hint, error, children }: { label: string; hint: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-primary">{label}</label>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1.5 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
