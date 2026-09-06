import { ArrowUp, Brain, CheckCircle2, ChevronDown, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "wouter";
import {
  useSendTutorMessage,
  useGetTutorConversation,
  getGetTutorConversationQueryKey,
  useListCourses,
  getListCoursesQueryKey,
} from "@workspace/api-client-react";
import type { TutorMessage } from "@workspace/api-client-react";
import { AppShell, ErrorNotice, PageHeading } from "@/components/app-shell";
import { TutorMarkdown } from "@/components/tutor-markdown";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage, isBudgetError } from "@/lib/format";

type ChatMessage = { role: string; message: string; prompt?: string };
const GENERAL = "__general__";

export default function TutorPage() {
  const [searchParams] = useSearchParams();
  const coursesQuery = useListCourses(undefined, { query: { queryKey: getListCoursesQueryKey() } });
  const courses = (coursesQuery.data ?? []).filter((c) => c.status === "active");

  const [courseId, setCourseId] = useState<string>(searchParams.get("course") ?? GENERAL);
  const [topicName, setTopicName] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedCourse = courses.find((c) => c.id === courseId);
  const effectiveCourseId = selectedCourse ? courseId : null;

  const conversationQuery = useGetTutorConversation(
    { courseId: effectiveCourseId ?? undefined },
    { query: { queryKey: getGetTutorConversationQueryKey({ courseId: effectiveCourseId ?? undefined }) } },
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const sendMessage = useSendTutorMessage();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(conversationQuery.data?.messages ?? []);
    setConversationId(conversationQuery.data?.conversationId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationQuery.data, effectiveCourseId]);

  useEffect(() => {
    setTopicName("");
  }, [courseId]);

  const submit = (value = draft) => {
    const message = value.trim();
    if (!message || sendMessage.isPending) return;
    setDraft("");
    setMessages((current) => [...current, { role: "student", message }]);
    sendMessage.mutate(
      { data: { message, courseId: effectiveCourseId, topicName: topicName || null, conversationId } },
      {
        onSuccess: (reply: TutorMessage) => {
          setMessages((current) => [...current, reply]);
          setConversationId(reply.conversationId);
        },
        onError: (err) => {
          if (isBudgetError(err)) {
            // Don't leave an unanswered message sitting in the transcript —
            // give the question back to the input so nothing typed is lost.
            setMessages((current) => current.slice(0, -1));
            setDraft(message);
            toast({ title: "AI allowance reached", description: getApiErrorMessage(err, "Try again later."), variant: "destructive" });
            return;
          }
          setMessages((current) => [
            ...current,
            { role: "tutor", message: "I lost my train of thought for a moment. Try asking that again, or break it into a smaller question." },
          ]);
        },
      },
    );
  };

  const resetConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  const studyingLabel = selectedCourse ? `${selectedCourse.name}${topicName ? ` · ${topicName}` : ""}` : "General questions";
  const activeTopicMastery = selectedCourse?.topics.find((topic) => topic.name === topicName)?.masteryLevel ?? null;
  const promptSuggestions = buildPromptSuggestions({
    hasMessages: messages.length > 0,
    courseName: selectedCourse?.name ?? null,
    topicName,
    masteryLevel: activeTopicMastery,
  });

  return (
    <AppShell>
      <div className="coach-rise">
        <PageHeading
          eyebrow="Socratic tutor"
          title="Think it through."
          description="A conversation that helps you reach the answer yourself."
          action={
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-chart-2 coach-pulse" /> Tutor is ready
            </div>
          }
        />

        <div className="mb-5 rounded-2xl border border-border bg-card px-4 py-3" data-testid="bar-tutor-context">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono-ui text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Studying</p>
              <p className="mt-0.5 text-[14px] font-semibold text-primary" data-testid="text-studying-label">{studyingLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              data-testid="button-change-course"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              Change course <ChevronDown className={`h-3.5 w-3.5 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {pickerOpen && (
            <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
              <select
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                data-testid="select-tutor-course"
                className="form-input"
              >
                <option value={GENERAL}>General questions (no course)</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
              {selectedCourse && selectedCourse.topics.length > 0 && (
                <select
                  value={topicName}
                  onChange={(event) => setTopicName(event.target.value)}
                  data-testid="select-tutor-topic"
                  className="form-input"
                >
                  <option value="">No specific topic</option>
                  {selectedCourse.topics.map((topic) => (
                    <option key={topic.name} value={topic.name}>{topic.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <section className="flex min-h-[600px] flex-col rounded-[24px] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar text-accent"><Brain className="h-4 w-4" /></div>
                <div>
                  <p className="text-[13px] font-semibold text-primary">Study Coach</p>
                  <p className="font-mono-ui text-[10px] text-muted-foreground">Guiding, not giving away</p>
                </div>
              </div>
              <button type="button" onClick={resetConversation} data-testid="button-reset-tutor" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" title="Reset conversation">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-auto p-5 sm:p-7">
              {conversationQuery.isLoading ? (
                <p className="text-[12px] text-muted-foreground">Loading your conversation...</p>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <p className="text-[13px] font-semibold text-primary">Ask about anything you're studying.</p>
                  <p className="max-w-xs text-[12px]">Your tutor will guide you toward the answer rather than just handing it over.</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "student" ? "justify-end" : "justify-start"}`} data-testid={`message-${message.role}-${index}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed sm:max-w-[80%] ${message.role === "student" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-primary"}`}>
                      {message.role !== "student" && (
                        <div className="mb-2 flex items-center gap-1.5 font-mono-ui text-[9px] uppercase tracking-[0.14em] text-primary/50"><Sparkles className="h-3 w-3" /> Coach</div>
                      )}
                      {message.role === "student" ? message.message : <TutorMarkdown content={message.message} />}
                    </div>
                  </div>
                ))
              )}
            </div>
            {sendMessage.isError && <div className="px-5 pb-3 sm:px-7"><ErrorNotice message="Your message didn't reach the tutor." /></div>}
            <div className="border-t border-border p-4 sm:p-5">
              <div className="relative rounded-2xl border border-input bg-background focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Ask a question or share your thinking..."
                  rows={2}
                  data-testid="input-tutor-message"
                  className="w-full resize-none bg-transparent px-4 py-3 pr-14 text-[13px] outline-none placeholder:text-muted-foreground/65"
                />
                <button
                  type="button"
                  onClick={() => submit()}
                  disabled={!draft.trim() || sendMessage.isPending}
                  aria-label="Send message"
                  data-testid="button-send-tutor"
                  className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:-translate-y-0.5 disabled:opacity-40"
                >
                  {sendMessage.isPending ? <span className="h-3 w-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground coach-pulse" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">Press Enter to send · Shift + Enter for a new line</p>
            </div>
          </section>
          <aside className="space-y-4">
            <div className="rounded-[22px] border border-accent/30 bg-accent/15 p-5">
              <div className="mb-3 flex items-center gap-2 text-primary"><Lightbulb className="h-4 w-4" /><p className="font-mono-ui text-[10px] uppercase tracking-[0.15em]">{messages.length === 0 ? "Start the conversation" : "Try a follow-up"}</p></div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {messages.length === 0 ? "Not sure how to open? Pick one — it's tailored to what you're studying." : "Keep going, or steer the conversation somewhere new."}
              </p>
              <div className="mt-4 space-y-2">
                {promptSuggestions.map((text) => (
                  <PromptButton key={text} text={text} onClick={submit} />
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-2xl px-2 py-1 text-[11px] leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-2" />
              Your tutor remembers the context of this conversation, and grounds answers in your course material when it's relevant.
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

/**
 * A follow-up ("give me a hint", "explain that differently") only makes
 * sense once there's something on screen to follow up on — with an empty
 * chat those read as non-sequiturs. So an empty conversation gets chat
 * *starters* instead, tailored to whatever course/topic is currently
 * selected (and, once a topic is picked, nudged by how well the student
 * already knows it) rather than the same three generic lines regardless of
 * context.
 */
function buildPromptSuggestions(options: {
  hasMessages: boolean;
  courseName: string | null;
  topicName: string;
  masteryLevel: string | null;
}): string[] {
  const { hasMessages, courseName, topicName, masteryLevel } = options;

  if (hasMessages) {
    return ["Can you explain that a different way?", "Give me a hint instead of the answer", "Quiz me on what we just covered"];
  }

  if (courseName && topicName) {
    const opener =
      masteryLevel === "proficient" || masteryLevel === "mastered"
        ? `Give me a challenging question on ${topicName}`
        : masteryLevel === "learning" || masteryLevel === "developing"
          ? `Help me get more comfortable with ${topicName}`
          : `Can you introduce me to ${topicName}?`;
    return [opener, `Walk me through ${topicName} step by step`, `Quiz me on ${topicName}`];
  }

  if (courseName) {
    return [`What's the most important idea in ${courseName} right now?`, `Can you walk me through ${courseName} from the basics?`, `Quiz me on ${courseName}`];
  }

  return ["I'm stuck on something — can you help me work through it?", "Can you walk me through a concept from scratch?", "Quiz me to see what I remember"];
}

function PromptButton({ text, onClick }: { text: string; onClick: (value: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      data-testid={`button-prompt-${text.slice(0, 8).replaceAll(" ", "-").toLowerCase()}`}
      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[11px] font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-background"
    >
      {text}
    </button>
  );
}
