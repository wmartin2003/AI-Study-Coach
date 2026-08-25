import { ArrowUp, Brain, CheckCircle2, Lightbulb, MessageCircle, RotateCcw, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useSendTutorMessage } from "@workspace/api-client-react";
import type { TutorMessage } from "@workspace/api-client-react";
import { AppShell, ErrorNotice, PageHeading } from "@/components/app-shell";

type ChatMessage = { role: string; message: string; prompt?: string };
const starterMessages: ChatMessage[] = [
  { role: "tutor", message: "Let's work through routing protocols together. I won't give you the answer straight away — I'll ask the questions that help you find it.", prompt: "Compare distance-vector and link-state routing" },
  { role: "student", message: "I understand that routers need to find the best path, but I'm fuzzy on how they learn about the network." },
  { role: "tutor", message: "Good starting point. Imagine each router only knows its neighbours at first. What might it share with those neighbours to gradually build a picture of the network?" },
];

export default function TutorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [draft, setDraft] = useState("");
  const [context, setContext] = useState("Computer Networks · Routing protocols");
  const sendMessage = useSendTutorMessage();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const submit = (value = draft) => {
    const message = value.trim();
    if (!message || sendMessage.isPending) return;
    setDraft("");
    setMessages((current) => [...current, { role: "student", message }]);
    sendMessage.mutate({ data: { message, context } }, { onSuccess: (reply: TutorMessage) => setMessages((current) => [...current, reply]), onError: () => setMessages((current) => [...current, { role: "tutor", message: "I lost my train of thought for a moment. Try asking that again, or break it into a smaller question." }]) });
  };
  return <AppShell>
    <div className="coach-rise">
      <PageHeading eyebrow="Socratic tutor" title="Think it through." description="A conversation that helps you reach the answer yourself." action={<div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-chart-2 coach-pulse" /> Tutor is ready</div>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <section className="flex min-h-[600px] flex-col rounded-[24px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-accent"><Brain className="h-4 w-4" /></div><div><p className="text-[13px] font-semibold text-primary">Study Coach</p><p className="font-mono-ui text-[10px] text-muted-foreground">Guiding, not giving away</p></div></div><button type="button" onClick={() => setMessages(starterMessages)} data-testid="button-reset-tutor" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" title="Reset conversation"><RotateCcw className="h-4 w-4" /></button></div>
          <div className="flex-1 space-y-5 overflow-auto p-5 sm:p-7">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "student" ? "justify-end" : "justify-start"}`} data-testid={`message-${message.role}-${index}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed sm:max-w-[72%] ${message.role === "student" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-primary"}`}>{message.role !== "student" && <div className="mb-2 flex items-center gap-1.5 font-mono-ui text-[9px] uppercase tracking-[0.14em] text-primary/50"><Sparkles className="h-3 w-3" /> Coach</div>}{message.message}</div></div>)}</div>
          {sendMessage.isError && <div className="px-5 pb-3 sm:px-7"><ErrorNotice message="Your message didn't reach the tutor." /></div>}
          <div className="border-t border-border p-4 sm:p-5"><div className="relative rounded-2xl border border-input bg-background focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Ask a question or share your thinking..." rows={2} data-testid="input-tutor-message" className="w-full resize-none bg-transparent px-4 py-3 pr-14 text-[13px] outline-none placeholder:text-muted-foreground/65" /><button type="button" onClick={() => submit()} disabled={!draft.trim() || sendMessage.isPending} data-testid="button-send-tutor" className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:-translate-y-0.5 disabled:opacity-40">{sendMessage.isPending ? <span className="h-3 w-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground coach-pulse" /> : <ArrowUp className="h-4 w-4" />}</button></div><p className="mt-2 text-center text-[10px] text-muted-foreground">Press Enter to send · Shift + Enter for a new line</p></div>
        </section>
        <aside className="space-y-4"><div className="rounded-[22px] border border-border bg-card p-5"><div className="mb-4 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /><p className="font-mono-ui text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Conversation context</p></div><label className="text-[11px] font-semibold text-primary" htmlFor="tutor-context">Studying</label><select id="tutor-context" value={context} onChange={(event) => setContext(event.target.value)} data-testid="select-tutor-context" className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[12px] text-primary outline-none focus:border-primary"><option>Computer Networks · Routing protocols</option><option>Computer Networks · Transport layer</option><option>Computer Networks · Network security</option></select></div>
          <div className="rounded-[22px] border border-accent/30 bg-accent/15 p-5"><div className="mb-3 flex items-center gap-2 text-primary"><Lightbulb className="h-4 w-4" /><p className="font-mono-ui text-[10px] uppercase tracking-[0.15em]">Try a prompt</p></div><p className="text-[12px] leading-relaxed text-muted-foreground">Start with what you know. The tutor will meet you there.</p><div className="mt-4 space-y-2"><PromptButton text="Why does BGP need path vectors?" onClick={submit} /><PromptButton text="Give me a routing analogy" onClick={submit} /></div></div>
          <div className="flex items-start gap-2.5 rounded-2xl px-2 py-1 text-[11px] leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-2" />Your tutor remembers the context of this conversation.</div></aside>
      </div>
    </div>
  </AppShell>;
}

function PromptButton({ text, onClick }: { text: string; onClick: (value: string) => void }) { return <button type="button" onClick={() => onClick(text)} data-testid={`button-prompt-${text.slice(0, 8).replaceAll(" ", "-").toLowerCase()}`} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[11px] font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-background">{text}</button>; }