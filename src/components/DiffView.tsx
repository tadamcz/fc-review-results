// The fix as a unified diff: hunks with old/new line numbers, each line
// highlighted as Lean from the whole before/after texts (so tokens that span
// lines still colour correctly), unchanged runs collapsed. A toggle shows the
// edited file whole with its added lines marked.
import { structuredPatch } from "diff";
import { useMemo, useState } from "react";
import type { ThemedToken } from "shiki/core";
import { tokenizeLean, useHighlighter } from "../highlight";
import { Code } from "./Code";

const CONTEXT = 3;

function tokenStyle(t: ThemedToken): React.CSSProperties | undefined {
  const fs = t.fontStyle ?? 0;
  if (!t.color && !fs) return undefined;
  return { color: t.color, fontStyle: fs & 1 ? "italic" : undefined, fontWeight: fs & 2 ? "bold" : undefined };
}

function Line({ tokens, text }: { tokens: ThemedToken[] | undefined; text: string }) {
  if (!tokens) return <>{text}</>;
  return (
    <>
      {tokens.map((t, j) => (
        <span key={j} style={tokenStyle(t)}>
          {t.content}
        </span>
      ))}
    </>
  );
}

export function diffStats(before: string, after: string): { added: number; removed: number } {
  const patch = structuredPatch("a", "b", before, after, "", "", { context: 0 });
  let added = 0;
  let removed = 0;
  for (const h of patch.hunks)
    for (const l of h.lines) {
      if (l.startsWith("+")) added++;
      else if (l.startsWith("-")) removed++;
    }
  return { added, removed };
}

export function DiffView({ before, after }: { before: string; after: string }) {
  const ready = useHighlighter();
  const [whole, setWhole] = useState(false);
  const patch = useMemo(() => structuredPatch("a", "b", before, after, "", "", { context: CONTEXT }), [before, after]);
  const beforeTokens = useMemo(() => (ready ? tokenizeLean(before.replace(/\n$/, "")) : null), [ready, before]);
  const afterTokens = useMemo(() => (ready ? tokenizeLean(after.replace(/\n$/, "")) : null), [ready, after]);
  const addedLines = useMemo(() => {
    const s = new Set<number>();
    for (const h of patch.hunks) {
      let n = h.newStart;
      for (const l of h.lines) {
        if (l.startsWith("+")) s.add(n);
        if (!l.startsWith("-")) n++;
      }
    }
    return s;
  }, [patch]);

  if (before === after) return <p className="muted">The file was not changed.</p>;

  return (
    <div className="diffview">
      <div className="view-toggle" role="group" aria-label="Diff view">
        <button className={whole ? "" : "active"} onClick={() => setWhole(false)}>
          Diff
        </button>
        <button className={whole ? "active" : ""} onClick={() => setWhole(true)}>
          Edited file
        </button>
      </div>
      {whole ? (
        <Code code={after} startLine={1} className="whole-file" marks={Object.fromEntries([...addedLines].map((n) => [n, "added"]))} />
      ) : (
        <pre className="diff code">
          {patch.hunks.map((h, k) => {
            let o = h.oldStart;
            let n = h.newStart;
            return (
              <span key={k} className="hunk">
                <span className="hunk-head line">
                  @@ -{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@{"\n"}
                </span>
                {h.lines.map((l, j) => {
                  const kind = l[0] === "+" ? "add" : l[0] === "-" ? "del" : "ctx";
                  const text = l.slice(1);
                  const oldNo = kind === "add" ? null : o++;
                  const newNo = kind === "del" ? null : n++;
                  const tokens = kind === "del" ? beforeTokens?.[oldNo! - 1] : afterTokens?.[newNo! - 1];
                  return (
                    <span key={j} className={`line ${kind}`}>
                      <span className="gutter">{oldNo ?? ""}</span>
                      <span className="gutter">{newNo ?? ""}</span>
                      <span className="sign">{kind === "add" ? "+" : kind === "del" ? "−" : " "}</span>
                      <Line tokens={tokens} text={text} />
                      {"\n"}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </pre>
      )}
    </div>
  );
}
