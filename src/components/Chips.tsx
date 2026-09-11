// The small labels used on rows and file pages: severity, finding kind, trivial-proof and fix outcomes.
import { useShowConfidence } from "../data/confidence";
import { fixLabel, trivialProofLabel } from "../data/labels";
import type { TrivialProofRow, FixRow, IndexRow, Severity } from "../data/schema";
import { trivialProofCompiles, kindLabel } from "../data/schema";

export { fixLabel, trivialProofLabel };

export function SeverityChip({ severity }: { severity: Severity }) {
  return <span className={`chip sev-${severity}`}>{severity}</span>;
}

export function KindChip({ kind }: { kind: string }) {
  return <span className="chip kind">{kindLabel(kind)}</span>;
}

export function Confidence({ value }: { value: number }) {
  if (!useShowConfidence()) return null;
  return (
    <span className="confidence muted" title="The reviewer's stated probability that this is a real defect">
      p = {value.toFixed(2)}
    </span>
  );
}

export function FixChip({ fix }: { fix: FixRow }) {
  const l = fixLabel(fix);
  return l ? <span className={`chip ${l.cls}`}>{l.text}</span> : null;
}

export function TrivialProofChip({ trivialProof }: { trivialProof: TrivialProofRow }) {
  const l = trivialProofLabel(trivialProof);
  return l ? <span className={`chip ${l.cls}`}>{l.text}</span> : null;
}

export function RowChips({ row }: { row: IndexRow }) {
  return (
    <span className="chips">
      {row.n_misformalizations > 0 && (
        <span className="chip sev-misformalization">
          {row.n_misformalizations} misformalization{row.n_misformalizations === 1 ? "" : "s"}
        </span>
      )}
      {row.n_status_issues > 0 && (
        <span className="chip status-issue">
          {row.n_status_issues} status issue{row.n_status_issues === 1 ? "" : "s"}
        </span>
      )}
      {row.n_questionable > 0 && <span className="chip sev-questionable">{row.n_questionable} questionable</span>}
      {trivialProofCompiles(row.trivial_proof) && <TrivialProofChip trivialProof={row.trivial_proof} />}
      <FixChip fix={row.fix} />
      {!row.submitted && <span className="chip warn">no review submitted</span>}
    </span>
  );
}
