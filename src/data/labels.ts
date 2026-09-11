// The words the site uses for a file's outcomes: the trivial-proof and fix chips, and the counts in
// the file page's summary band. Shared with scripts/file-issues.ts, whose issue bullets mirror that
// band, so the two cannot drift apart.
import type { FileEntry, FixRow, TrivialProofRow } from "./schema";
import { trivialProofCompiles } from "./schema";

export function fixLabel(fix: FixRow): { text: string; cls: string } | null {
  if (!fix.attempted) return null;
  if (fix.gave_up) return { text: "fix: bailed out", cls: "fix-gaveup" };
  if (fix.changed && fix.compile_ok) return { text: "fix compiles", cls: "fix-ok" };
  if (fix.changed) return { text: "fix does not compile", cls: "fix-bad" };
  return { text: "no edit", cls: "fix-none" };
}

export function trivialProofLabel(tp: TrivialProofRow): { text: string; cls: string } | null {
  if (!tp.attempted) return null;
  if (tp.gave_up) return { text: "trivial proof: bailed out", cls: "tp-none" };
  if (!tp.written) return { text: "no trivial-proof file", cls: "tp-none" };
  if (trivialProofCompiles(tp)) return { text: "trivial proof compiles", cls: "tp-ok" };
  if (tp.compile_ok) return { text: "trivial proof uses sorry", cls: "tp-weak" };
  return { text: "trivial proof does not compile", cls: "tp-weak" };
}

// The summary band's counts, left to right: "1 misformalization", "1 status issue", "2 equivalent reformulations"
export function summaryParts(entry: FileEntry): string[] {
  const r = entry.review;
  if (!r.submitted) return ["no review was submitted"];
  const parts: string[] = [];
  const misf = r.findings.filter((f) => f.severity === "misformalization").length;
  parts.push(`${misf} misformalization${misf === 1 ? "" : "s"}`);
  const q = r.findings.filter((f) => f.severity === "questionable").length;
  const m = r.findings.filter((f) => f.severity === "minor").length;
  if (q) parts.push(`${q} questionable`);
  if (m) parts.push(`${m} minor`);
  if (r.status_issues.length) parts.push(`${r.status_issues.length} status issue${r.status_issues.length === 1 ? "" : "s"}`);
  if (r.reformulations.length) parts.push(`${r.reformulations.length} equivalent reformulation${r.reformulations.length === 1 ? "" : "s"}`);
  return parts;
}
