import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the tutor's Markdown responses with typography that matches the
 * rest of the app (serif display headings, mono for code) rather than
 * generic prose defaults — headings, bullets, numbered steps, bold,
 * blockquotes-as-key-concepts, and code all get a distinct, legible
 * treatment without turning every reply into a decorated "card."
 */
const components: Components = {
  h1: ({ children }) => <h3 className="mt-3 mb-1.5 font-display text-[16px] font-semibold text-primary first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1.5 font-display text-[15px] font-semibold text-primary first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-2.5 mb-1 text-[13px] font-bold text-primary first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 marker:text-accent last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 marker:font-semibold marker:text-primary/70 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2 hover:text-accent">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 rounded-xl border-l-[3px] border-accent bg-accent/10 px-3.5 py-2.5 text-primary/90 first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={`block font-mono-ui text-[11.5px] leading-relaxed ${className ?? ""}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono-ui text-[11.5px] text-primary" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2.5 overflow-x-auto rounded-xl bg-primary p-3.5 text-primary-foreground first:mt-0 last:mb-0">{children}</pre>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2.5 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border bg-secondary/50 px-2.5 py-1.5 font-semibold text-primary">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/60 px-2.5 py-1.5">{children}</td>,
};

export function TutorMarkdown({ content }: { content: string }) {
  return (
    <div className="tutor-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
