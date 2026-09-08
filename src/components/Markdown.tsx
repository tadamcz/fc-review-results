// Markdown + math (docstrings, the reviewer's notes). Links open in a new tab.
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { remarkBareUrls } from "./linkify";

// `$$…$$` inside a paragraph (as Lean docstrings write it) is not a math block
// for remark-math; give every display run its own lines.
export function normalizeMath(text: string): string {
  return text.replace(/\$\$([\s\S]+?)\$\$/g, (_, inner: string) => `\n\n$$\n${inner.trim()}\n$$\n\n`);
}

export function Markdown({ text, className, dropHeading = false }: { text: string; className?: string; dropHeading?: boolean }) {
  const src = normalizeMath(dropHeading ? text.replace(/^\s*#\s+[^\n]*\n?/, "") : text);
  return (
    <div className={`md ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkBareUrls]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {src}
      </ReactMarkdown>
    </div>
  );
}
