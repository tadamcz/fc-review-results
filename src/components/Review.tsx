// The review's content: findings by severity, status issues, reformulations,
// what the reviewer read and could not settle.
import { Link } from "react-router";
import type { FileEntry, Finding, Reformulation, StatusIssue } from "../data/schema";
import { Code } from "./Code";
import { Confidence, KindChip, SeverityChip } from "./Chips";
import { Disclosure } from "./Disclosure";
import { linkify } from "./linkify";
import { Markdown } from "./Markdown";

export function DeclLink({ name, line, search }: { name: string; line: number | null; search: string }) {
  if (line === null) return <code className="fq">{name}</code>;
  return (
    <Link to={{ hash: `L${line}`, search }} className="fq decl-link" title={`line ${line} of the file`} onClick={() => jumpToLine(line)}>
      {name}
    </Link>
  );
}

export function jumpToLine(line: number): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(`L${line}`);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  });
}

function FindingView({ f, search }: { f: Finding; search: string }) {
  return (
    <li className={`finding sev-${f.severity}`}>
      <div className="finding-head">
        <DeclLink name={f.declaration} line={f.line} search={search} />
        <SeverityChip severity={f.severity} />
        <KindChip kind={f.kind} />
        <Confidence value={f.confidence} />
      </div>
      <Markdown text={f.description} className="finding-body" />
      {f.source_evidence && (
        <div className="evidence">
          <span className="label">Source says</span>
          <Markdown text={f.source_evidence} />
        </div>
      )}
      {f.suggested_fix && (
        <div className="suggested">
          <span className="label">Suggested fix</span>
          {looksLikeLean(f.suggested_fix) ? <Code code={f.suggested_fix} /> : <Markdown text={f.suggested_fix} />}
        </div>
      )}
    </li>
  );
}

function looksLikeLean(s: string): boolean {
  return /^\s*(theorem|lemma|def|abbrev|structure|instance|@\[|\/--|--|noncomputable|open|import)/.test(s) || (s.includes(":=") && s.split("\n").length > 1);
}

export function Findings({ entry, search }: { entry: FileEntry; search: string }) {
  const { findings } = entry.review;
  const misf = findings.filter((f) => f.severity === "misformalization");
  const questionable = findings.filter((f) => f.severity === "questionable");
  const minor = findings.filter((f) => f.severity === "minor");
  return (
    <>
      <h2 id="misformalizations">
        Misformalizations <span className="muted">({misf.length})</span>
      </h2>
      {misf.length === 0 && <p className="muted">{entry.review.submitted ? "None reported." : "No review was submitted for this file."}</p>}
      <ol className="findings">
        {misf.map((f, i) => (
          <FindingView key={i} f={f} search={search} />
        ))}
      </ol>
      {questionable.length > 0 && (
        <>
          <h2 id="questionable">
            Questionable <span className="muted">({questionable.length})</span>
          </h2>
          <p className="muted small">Defensible but debatable modelling choices the reviewer wanted a maintainer to look at.</p>
          <ol className="findings">
            {questionable.map((f, i) => (
              <FindingView key={i} f={f} search={search} />
            ))}
          </ol>
        </>
      )}
      {minor.length > 0 && (
        <Disclosure
          className="minor-block"
          summary={
            <>
              <strong>Minor</strong> <span className="muted">· {minor.length} docstring or reference slip{minor.length === 1 ? "" : "s"} that leave the mathematics intact</span>
            </>
          }
        >
          <ol className="findings">
            {minor.map((f, i) => (
              <FindingView key={i} f={f} search={search} />
            ))}
          </ol>
        </Disclosure>
      )}
    </>
  );
}

export function StatusIssues({ issues, search }: { issues: StatusIssue[]; search: string }) {
  if (issues.length === 0) return null;
  return (
    <>
      <h2 id="status">
        Status issues <span className="muted">({issues.length})</span>
      </h2>
      <p className="muted small">The statement is the problem as posed; what the file records about its status disagrees with the source. Not counted as misformalizations.</p>
      <ol className="findings">
        {issues.map((s, i) => (
          <li key={i} className="finding status-issue">
            <div className="finding-head">
              <DeclLink name={s.declaration} line={s.line} search={search} />
              <span className="chip status-issue">status</span>
              <Confidence value={s.confidence} />
            </div>
            <dl className="kv">
              <dt>File records</dt>
              <dd>
                <Markdown text={s.recorded} />
              </dd>
              <dt>Source records</dt>
              <dd>
                <Markdown text={s.source_status} />
              </dd>
              {s.evidence && (
                <>
                  <dt>Evidence</dt>
                  <dd>{linkify(s.evidence)}</dd>
                </>
              )}
              {s.suggested_change && (
                <>
                  <dt>Suggested change</dt>
                  <dd>
                    <Markdown text={s.suggested_change} />
                  </dd>
                </>
              )}
            </dl>
          </li>
        ))}
      </ol>
    </>
  );
}

export function Reformulations({ items, search }: { items: Reformulation[]; search: string }) {
  if (items.length === 0) return null;
  const proved = items.filter((r) => r.proved_in_lean).length;
  return (
    <Disclosure
      className="reform-block"
      summary={
        <>
          <strong>Equivalent reformulations</strong>{" "}
          <span className="muted">
            · {items.length} place{items.length === 1 ? "" : "s"} where the Lean differs from the source in form but was judged equivalent
            {proved ? ` (${proved} with an ↔ proved in Lean)` : ""}
          </span>
        </>
      }
    >
      <ol className="findings">
        {items.map((r, i) => (
          <li key={i} className="finding reform">
            <div className="finding-head">
              <DeclLink name={r.declaration} line={r.line} search={search} />
              {r.proved_in_lean && <span className="chip proved">↔ proved in Lean</span>}
              <Confidence value={r.confidence} />
            </div>
            <Markdown text={r.difference} className="finding-body" />
            {r.equivalence_argument && (
              <div className="evidence">
                <span className="label">Why equivalent</span>
                <Markdown text={r.equivalence_argument} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}

export function ReviewerNotes({ entry }: { entry: FileEntry }) {
  const { notes, could_not_verify, sources_consulted } = entry.review;
  if (!notes && could_not_verify.length === 0 && sources_consulted.length === 0) return null;
  return (
    <>
      {notes && (
        <>
          <h2>Reviewer's notes</h2>
          <Markdown text={notes} className="notes" />
        </>
      )}
      {could_not_verify.length > 0 && (
        <>
          <h3>Could not verify</h3>
          <ul className="plain-list">
            {could_not_verify.map((c, i) => (
              <li key={i}>
                <Markdown text={c} />
              </li>
            ))}
          </ul>
        </>
      )}
      {sources_consulted.length > 0 && (
        <Disclosure
          summary={
            <>
              <strong>Sources consulted</strong> <span className="muted">· {sources_consulted.length}</span>
            </>
          }
        >
          <ul className="plain-list sources">
            {sources_consulted.map((s, i) => (
              <li key={i}>{linkify(s)}</li>
            ))}
          </ul>
        </Disclosure>
      )}
    </>
  );
}
