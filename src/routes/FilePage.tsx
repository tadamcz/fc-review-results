import { useEffect, useMemo } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { FixChip } from "../components/Chips";
import { Code } from "../components/Code";
import { DiffView, diffStats } from "../components/DiffView";
import { Disclosure } from "../components/Disclosure";
import { Markdown } from "../components/Markdown";
import { Findings, Reformulations, ReviewerNotes, StatusIssues, jumpToLine } from "../components/Review";
import { TopBar } from "../components/TopBar";
import { applyFilters, money, neighbours, parseState } from "../data/filters";
import { useFile, useIndex } from "../data/load";
import type { FileEntry } from "../data/schema";

export function FilePage() {
  const params = useParams();
  const id = params["*"];
  const [search] = useSearchParams();
  const location = useLocation();
  const index = useIndex();
  const file = useFile(id);

  const state = useMemo(() => parseState(search), [search]);
  const ids = useMemo(() => (index.status === "ok" ? applyFilters(index.data.files, state).map((r) => r.id) : []), [index, state]);
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
        {file.status === "ok" && index.status === "ok" && <FileBody entry={file.data} search={searchStr} viewerUrl={index.data.meta.viewer_url} />}
      </main>
    </>
  );
}

function FileBody({ entry, search, viewerUrl }: { entry: FileEntry; search: string; viewerUrl: string | null }) {
  const misf = entry.review.findings.filter((f) => f.severity === "misformalization");
  const marks = useMemo(() => {
    const m: Record<number, string> = {};
    for (const r of entry.review.reformulations) if (r.line) m[r.line] = "mark-reform";
    for (const s of entry.review.status_issues) if (s.line) m[s.line] = "mark-status";
    for (const f of entry.review.findings) if (f.line) m[f.line] = `mark-${f.severity}`;
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
      <Summary entry={entry} misf={misf.length} viewerUrl={viewerUrl} />

      <Findings entry={entry} search={search} />
      <FixSection entry={entry} />
      <StatusIssues issues={entry.review.status_issues} search={search} />
      <Reformulations items={entry.review.reformulations} search={search} />
      <ReviewerNotes entry={entry} />

      <h2 id="file">The file at the reviewed commit</h2>
      <p className="muted small">
        Marked lines: <span className="swatch mark-misformalization" /> misformalization · <span className="swatch mark-questionable" /> questionable ·{" "}
        <span className="swatch mark-minor" /> minor · <span className="swatch mark-status" /> status issue · <span className="swatch mark-reform" /> reformulation judged equivalent
      </p>
      <Code code={entry.lean} startLine={1} className="whole-file" marks={marks} />
    </>
  );
}

function Summary({ entry, misf, viewerUrl }: { entry: FileEntry; misf: number; viewerUrl: string | null }) {
  const r = entry.review;
  const parts: string[] = [];
  if (!r.submitted) parts.push("no review was submitted");
  else {
    parts.push(`${misf} misformalization${misf === 1 ? "" : "s"}`);
    const q = r.findings.filter((f) => f.severity === "questionable").length;
    const m = r.findings.filter((f) => f.severity === "minor").length;
    if (q) parts.push(`${q} questionable`);
    if (m) parts.push(`${m} minor`);
    if (r.status_issues.length) parts.push(`${r.status_issues.length} status issue${r.status_issues.length === 1 ? "" : "s"}`);
    if (r.reformulations.length) parts.push(`${r.reformulations.length} equivalent reformulation${r.reformulations.length === 1 ? "" : "s"}`);
  }
  return (
    <div className={`status-line`}>
      <div className={`status ${misf ? "warn" : ""}`}>
        <strong>{parts.join(" · ")}</strong> <FixChip fix={entry.fix} />
        <span className="muted small">
          {" "}
          · review cost {money(entry.sample.cost_usd)}, {entry.sample.working_minutes} min working time
          {entry.sample.examples_shown !== null ? `, ${entry.sample.examples_shown} past fixes shown as examples` : ""}
          {viewerUrl && entry.sample.uuid ? (
            <>
              {" · "}
              <a href={viewerUrl} target="_blank" rel="noopener noreferrer">
                transcript
              </a>{" "}
              <span title="sample uuid in the Hawk viewer">({entry.sample.uuid.slice(0, 8)})</span>
            </>
          ) : null}
        </span>
      </div>
    </div>
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
