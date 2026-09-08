// Bare URLs in text become links (used for code lines and, through a remark
// plugin, for docstrings and notes). Trailing punctuation and an unbalanced
// closing bracket are left outside the link, so "(see https://x.org/a)." links
// https://x.org/a and "[t](https://x.org/A_(b))" links https://x.org/A_(b).
import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s<>"`]+/g;

function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const last = url[url.length - 1];
    if (".,;:!?*".includes(last)) {
      url = url.slice(0, -1);
    } else if ((last === ")" && count(url, ")") > count(url, "(")) || (last === "]" && count(url, "]") > count(url, "["))) {
      url = url.slice(0, -1);
    } else {
      return url;
    }
  }
}

function count(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

export type Piece = string | { url: string };

/** Split text into plain pieces and URLs; an array of one string when there is no URL. */
export function splitUrls(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push({ url });
    last = start + url.length;
  }
  if (last < text.length || out.length === 0) out.push(text.slice(last));
  return out;
}

export function linkify(text: string): ReactNode {
  const pieces = splitUrls(text);
  if (pieces.length === 1 && typeof pieces[0] === "string") return text;
  return pieces.map((p, i) =>
    typeof p === "string" ? (
      p
    ) : (
      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
        {p.url}
      </a>
    ),
  );
}

// remark plugin: bare URLs in markdown text become links (markdown's own
// [text](url) links and code spans are untouched).
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

export function remarkBareUrls() {
  return (tree: MdNode) => {
    const walk = (node: MdNode) => {
      if (!node.children || node.type === "link" || node.type === "linkReference") return;
      const next: MdNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || typeof child.value !== "string") {
          walk(child);
          next.push(child);
          continue;
        }
        for (const p of splitUrls(child.value)) {
          if (typeof p === "string") next.push({ type: "text", value: p });
          else next.push({ type: "link", url: p.url, children: [{ type: "text", value: p.url }] });
        }
      }
      node.children = next;
    };
    walk(tree);
  };
}
