import { useEffect, useMemo } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { FixChip, TrivialProofChip } from "../components/Chips";
import { Code } from "../components/Code";
import { trivialProofCompiles } from "../data/schema";
import { DiffView, diffStats } from "../components/DiffView";
import { Disclosure } from "../components/Disclosure";
import { Markdown } from "../components/Markdown";
import { Findings, Reformulations, ReviewerNotes, StatusIssues, jumpToLine } from "../components/Review";
import { TopBar } from "../components/TopBar";
import { ConfidenceContext, effectiveState, showConfidence } from "../data/confidence";
import { DEFAULT_STATE, applyFilters, defaultShow, neighbours, parseState } from "../data/filters";
import { useFile, useIndex, useIssues, useUpstream } from "../data/load";
import { fixLabel, summaryParts, trivialProofLabel } from "../data/labels";
import type { FileEntry, IssueRecord, UpstreamRecord } from "../data/schema";

export function FilePage() {
  const params = useParams();
  const id = params["*"];
  const [search] = useSearchParams();
  const location = useLocation();
  const index = useIndex();
  const file = useFile(id);

  const dflt = index.status === "ok" ? defaultShow(index.data.meta) : DEFAULT_STATE.show; // the list's default view, so ‹ › walk the same files
  const state = useMemo(() => parseState(search, dflt), [search, dflt]);
  const showConf = index.status === "ok" ? showConfidence(index.data.meta) : true;
  const upstream = useUpstream(index.status === "ok" ? index.data.meta.upstream : null); // the run's upstream check, if any
  const filed = useIssues(); // the issues this project filed for the run, if any
  const ids = useMemo(
    () => (index.status === "ok" ? applyFilters(index.data.files, effectiveState(state, showConf)).map((r) => r.id) : []),
    [index, state, showConf],
  );
  const nav = id ? neighbours(ids, id) : { prev: null, next: null };
  const searchStr = search.toString();

  useEffect(() => {
    if (file.status === "ok") document.title = `${file.data.id} · Formal Conjectures audit`;
  }, [file]);

  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // deep link #L<n> scrolls to that line once the file has rendered
  useEffect(() => {
    const m = /^#L(\d+)$/.exec(location.hash);
    if (!m || file.status !== "ok") return;
    let tries = 0;
    const attempt = () => {
      if (document.getElementById(`L${m[1]}`)) jumpToLine(Number(m[1]));
      else if (tries++ < 20) window.setTimeout(attempt, 100);
    };
    attempt();
  }, [location.hash, file.status]);

  return (
    <>
      <TopBar>
        <span className="prevnext">
          {nav.prev ? <Link to={{ pathname: `/f/${nav.prev}`, search: searchStr }}>‹ prev</Link> : <span className="muted">‹ prev</span>}
          {" · "}
          {nav.next ? <Link to={{ pathname: `/f/${nav.next}`, search: searchStr }}>next ›</Link> : <span className="muted">next ›</span>}
        </span>
      </TopBar>
      <main className="page entry">
        {file.status === "loading" && <p className="muted">Loading…</p>}
        {file.status === "error" && <p className="error">Could not load this file: {file.error}</p>}
        {file.status === "ok" && index.status === "ok" && (
          <ConfidenceContext.Provider value={showConf}>
            <FileBody
              entry={file.data}
              search={searchStr}
              upstream={upstream.status === "ok" ? (upstream.data.get(file.data.id) ?? null) : null}
              filed={filed.status === "ok" ? (filed.data.get(file.data.id) ?? null) : null}
            />
          </ConfidenceContext.Provider>
        )}
      </main>
    </>
  );
}

function FileBody({ entry, search, upstream, filed }: { entry: FileEntry; search: string; upstream: UpstreamRecord | null; filed: IssueRecord | null }) {
  const marks = useMemo(() => {
    const m: Record<number, string> = {};
    for (const r of entry.review.reformulations) if (r.line) m[r.line] = "reform";
    for (const s of entry.review.status_issues) if (s.line) m[s.line] = "status";
    for (const f of entry.review.findings) if (f.line) m[f.line] = f.severity;
    return m;
  }, [entry]);
  return (
    <>
      <div className="crumbs">
        <Link to={{ pathname: "/", search }}>All files</Link>
        <span>›</span>
        <Link to={{ pathname: "/", search: new URLSearchParams({ c: entry.collection }).toString() }}>{entry.collection}</Link>
        {entry.kind === "library" && (
          <>
            <span>›</span>
            <span className="muted">reusable definitions</span>
          </>
        )}
      </div>
      <h1>{entry.id}</h1>
      <p className="fileline">
        <code>{entry.path}</code> ·{" "}
        <a href={entry.urls.github} target="_blank" rel="noopener noreferrer">
          on GitHub at the reviewed commit
        </a>{" "}
        · <span className="muted">module</span> <code>{entry.module}</code>
      </p>
      <Summary entry={entry} upstream={upstream} filed={filed} />

      <Findings entry={entry} search={search} />
      <TrivialProofSection entry={entry} />
      <FixSection entry={entry} />
      <StatusIssues issues={entry.review.status_issues} search={search} />
      <Reformulations items={entry.review.reformulations} search={search} />
      <ReviewerNotes entry={entry} />

      <h2 id="file">The file at the reviewed commit</h2>
      <p className="muted small legend">
        Gutter marks: <span className="gutter-mark gm-misformalization">✕</span> misformalization · <span className="gutter-mark gm-questionable">?</span> questionable ·{" "}
        <span className="gutter-mark gm-minor">~</span> minor · <span className="gutter-mark gm-status">⧗</span> status issue · <span className="gutter-mark gm-reform">≡</span>{" "}
        reformulation judged equivalent
      </p>
      <Code code={entry.lean} startLine={1} className="whole-file" marks={marks} />
    </>
  );
}

// "reported" with the GitHub mark, linking to the GitHub item about this file's misformalizations:
// the upstream item already covering them when the run's check found one (a fix merged after the
// reviewed commit, else an open pull request, else an open issue), otherwise the issue this project
// filed. What it is and its title on hover.
function GitHubLink({ upstream, filed }: { upstream: UpstreamRecord | null; filed: IssueRecord | null }) {
  let href: string, title: string;
  if (upstream) {
    const rank = (c: UpstreamRecord["covered_by"][number]) => (c.state === "merged" ? 0 : c.type === "pr" ? 1 : 2);
    const best = [...upstream.covered_by].sort((a, b) => rank(a) - rank(b))[0];
    if (!best) return null;
    const what = best.state === "merged" ? "Fixed by pull request" : best.type === "pr" ? "Fix proposed in pull request" : "Reported in issue";
    href = best.url;
    title = `${what} #${best.number}: ${best.title}`;
  } else if (filed) {
    href = filed.url;
    title = `Reported by this audit in issue #${filed.number}: ${filed.title}`;
  } else return null;
  return (
    <a className="chip upstream" href={href} target="_blank" rel="noopener noreferrer" title={title}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
      reported
    </a>
  );
}

function Summary({ entry, upstream, filed }: { entry: FileEntry; upstream: UpstreamRecord | null; filed: IssueRecord | null }) {
  const parts = summaryParts(entry);
  const misf = entry.review.findings.filter((f) => f.severity === "misformalization").length;
  const outcomes = Boolean(fixLabel(entry.fix) || upstream || filed); // anything for the second line: what was done about the problems
  return (
    <div className={`status-line`}>
      <div className={`status ${misf ? "warn" : ""}`}>
        <strong>{parts.join(" · ")}</strong>
        {trivialProofLabel(entry.trivial_proof) && (
          <>
            {" "}
            <TrivialProofChip trivialProof={entry.trivial_proof} />
          </>
        )}
        {outcomes && (
          <div className="status-fixes">
            <FixChip fix={entry.fix} />
            <GitHubLink upstream={upstream} filed={filed} />
          </div>
        )}
      </div>
      {entry.sample.transcript_url && (
        <div className="actions">
          <a className="btn link" href={entry.sample.transcript_url} target="_blank" rel="noopener noreferrer" title="Every model call of this review and its fix, in the Inspect log viewer">
            Transcript
          </a>
          <span className="muted small">the full conversation of this review in the Inspect log viewer, including every tool call</span>
        </div>
      )}
    </div>
  );
}

function TrivialProofSection({ entry }: { entry: FileEntry }) {
  const tp = entry.trivial_proof;
  if (!tp.attempted) return null;
  const sub = tp.submission;
  const ok = trivialProofCompiles(tp);
  return (
    <>
      <h2 id="trivial-proof">Trivial proof</h2>
      <p className="muted small">
        After submitting the review, the same model was asked for a trivial proof or disproof: one short Lean file, kept outside the repository, that proves or refutes the
        misformalized statements as the file states them in a few lines — a proof of a supposedly open statement that the defect makes trivial, a disproof by counterexample,
        or a computation on which a definition and the intended notion disagree. It could bail out when no defect admitted a short proof. The compile check is the harness's
        own run of <code>lake env lean</code> on the file, which must report no errors and no <code>sorry</code>. Unreviewed by a human.
      </p>
      <div className={`status ${tp.gave_up ? "" : ok ? "tp" : "warn"}`}>
        <TrivialProofChip trivialProof={tp} />{" "}
        {ok && (
          <span className="muted">
            {tp.n_demonstrated} declaration{tp.n_demonstrated === 1 ? "" : "s"} demonstrated
          </span>
        )}
        {tp.limit_hit && <span className="muted"> · stopped by limit: {tp.limit_hit}</span>}
        {tp.checkout_modified.length > 0 && <span className="error"> · the trivial-proof phase touched {tp.checkout_modified.length} path(s) in the checkout</span>}
      </div>
      {sub && (
        <div className="fix-report">
          {sub.gave_up && (
            <p>
              <strong>Bailed out:</strong> <Markdown text={sub.gave_up_reason} className="inline-md" />
            </p>
          )}
          {sub.summary && <Markdown text={sub.summary} className="fix-summary" />}
          {sub.demonstrated.length > 0 && (
            <ul className="plain-list small">
              {sub.demonstrated.map((d, i) => (
                <li key={i}>
                  <span className="label">{d.kind}</span> <code className="fq">{d.declaration}</code>: {d.claim}
                </li>
              ))}
            </ul>
          )}
          {sub.not_demonstrated.length > 0 && (
            <ul className="plain-list small">
              {sub.not_demonstrated.map((n, i) => (
                <li key={i}>
                  <span className="label">Not demonstrated</span> <code className="fq">{n.declaration}</code>: {n.reason}
                </li>
              ))}
            </ul>
          )}
          {tp.written && sub.compiles !== ok && (
            <p className="small error">
              The model reported compiles = {String(sub.compiles)}; the harness check says {ok ? "it compiles without sorry" : tp.compile_ok ? "it compiles but uses sorry" : "it does not compile"}.
            </p>
          )}
        </div>
      )}
      {tp.compile_errors.length > 0 && (
        <Disclosure summary={<span className="error">{tp.compile_errors.length} compile error(s) on the trivial-proof file</span>}>
          <ul className="plain-list small">
            {tp.compile_errors.map((e, i) => (
              <li key={i}>
                {e.line ? <code>line {e.line}</code> : null} {e.text}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {tp.lean && <Code code={tp.lean} startLine={1} className="whole-file" />}
    </>
  );
}

function FixSection({ entry }: { entry: FileEntry }) {
  const fix = entry.fix;
  if (!fix.attempted) return null;
  const sub = fix.submission;
  const stats = fix.after ? diffStats(entry.lean, fix.after) : null;
  return (
    <>
      <h2 id="fix">Proposed fix</h2>
      <p className="muted small">
        After submitting the review, the same model was asked to correct the misformalizations by editing the file in place. The edit is shown as a diff against the reviewed file; the
        compile check is the harness's own run of <code>lake env lean</code> on the edited file. Unreviewed by a human.
      </p>
      <div className={`status ${fix.gave_up ? "" : fix.changed && fix.compile_ok ? "fc" : "warn"}`}>
        <FixChip fix={fix} />{" "}
        {stats && (
          <span className="muted">
            +{stats.added} −{stats.removed} lines
          </span>
        )}
        {fix.limit_hit && <span className="muted"> · stopped by limit: {fix.limit_hit}</span>}
        {fix.reverted && <span className="muted"> · the harness restored the original file after the bail-out</span>}
        {fix.checkout_modified.length > 1 && <span className="error"> · the fix phase touched {fix.checkout_modified.length} paths in the checkout</span>}
      </div>
      {sub && (
        <div className="fix-report">
          {sub.gave_up && (
            <p>
              <strong>Bailed out:</strong> <Markdown text={sub.gave_up_reason} className="inline-md" />
            </p>
          )}
          {sub.summary && <Markdown text={sub.summary} className="fix-summary" />}
          {sub.fixed.length > 0 && (
            <p className="small">
              <span className="label">Fixed</span>{" "}
              {sub.fixed.map((d, i) => (
                <code key={i} className="fq">
                  {d}
                </code>
              ))}
            </p>
          )}
          {sub.not_fixed.length > 0 && (
            <ul className="plain-list small">
              {sub.not_fixed.map((n, i) => (
                <li key={i}>
                  <span className="label">Not fixed</span> <code className="fq">{n.declaration}</code>: {n.reason}
                </li>
              ))}
            </ul>
          )}
          {sub.compiles !== (fix.compile_ok ?? false) && fix.changed && (
            <p className="small error">The model reported compiles = {String(sub.compiles)}; the harness check says {String(fix.compile_ok)}.</p>
          )}
        </div>
      )}
      {fix.compile_errors.length > 0 && (
        <Disclosure summary={<span className="error">{fix.compile_errors.length} compile error(s) on the edited file</span>}>
          <ul className="plain-list small">
            {fix.compile_errors.map((e, i) => (
              <li key={i}>
                {e.line ? <code>line {e.line}</code> : null} {e.text}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {fix.after && <DiffView before={entry.lean} after={fix.after} />}
    </>
  );
}
