import { useEffect } from "react";
import { Link } from "react-router";
import { CommitAge } from "../components/CommitAge";
import { TopBar } from "../components/TopBar";
import { showConfidence } from "../data/confidence";
import { formatDate, money, plural } from "../data/filters";
import { useIndex, useIssues } from "../data/load";
import { runScope } from "../data/schema";
import { orderedCollections } from "./ListPage";

const REPO_URL = "https://github.com/tadamcz/fc-review-results";
const TASK_URL = "https://github.com/epoch-research/autoformalization/tree/fc-review";

export function AboutPage() {
  const index = useIndex();
  const filed = useIssues(); // the issues this project filed for the run, if any
  useEffect(() => {
    document.title = "About · Formal Conjectures audit";
  }, []);
  if (index.status !== "ok") {
    return (
      <>
        <TopBar />
        <main className="page narrow">{index.status === "loading" ? <p className="muted">Loading…</p> : <p className="error">{index.error}</p>}</main>
      </>
    );
  }
  const m = index.data.meta;
  const t = m.totals;
  const fixes = m.fix;
  const trivialProofs = m.trivial_proof;
  const hasTrivialProofs = (trivialProofs.attempted ?? 0) > 0; // the phase did not exist for earlier runs
  const { subset, library } = runScope(m);
  const issues = filed.status === "ok" ? [...filed.data.values()] : [];
  const filedOn = issues.length ? issues.map((i) => i.created_at).sort()[issues.length - 1] : null;
  const trivialProofPhase = hasTrivialProofs || m.task_args.trivial_proof === true; // the phase existed for this run
  const noteLink = m.note?.url ? m.note.url.replace(/^https?:\/\//, "") : null;
  return (
    <>
      <TopBar />
      <main className="page narrow about">
        <h1>About</h1>
        <p>
          {subset ? (
            <>
              This page shows the results of an automated review of {t.files} Lean files of{" "}
              <a href={m.fc_repo_url} target="_blank" rel="noopener noreferrer">
                google-deepmind/formal-conjectures
              </a>{" "}
              at commit{" "}
              <a href={m.fc_tree_url} target="_blank" rel="noopener noreferrer">
                <code>{m.fc_commit.slice(0, 10)}</code>
              </a>
              <CommitAge date={m.fc_commit_date} />
              .
              {m.note && (
                <>
                  {" "}
                  {m.note.text}
                  {m.note.url && (
                    <>
                      {" "}
                      (
                      <a href={m.note.url} target="_blank" rel="noopener noreferrer">
                        {noteLink}
                      </a>
                      )
                    </>
                  )}
                </>
              )}{" "}
              Each file was reviewed by a language model against the source it cites, looking for <em>misformalizations</em>: places where a Lean declaration does not state
              the mathematical claim its source poses.
            </>
          ) : (
            <>
              This site shows the results of an automated audit of{" "}
              <a href={m.fc_repo_url} target="_blank" rel="noopener noreferrer">
                google-deepmind/formal-conjectures
              </a>{" "}
              at commit{" "}
              <a href={m.fc_tree_url} target="_blank" rel="noopener noreferrer">
                <code>{m.fc_commit.slice(0, 10)}</code>
              </a>
              <CommitAge date={m.fc_commit_date} />
              . Every one of its {t.files}{" "}
              {library ? (
                <>
                  Lean files — the problem statements under <code>FormalConjectures/</code> and the reusable definitions under <code>FormalConjecturesForMathlib/</code> —
                </>
              ) : (
                <>
                  problem files under <code>FormalConjectures/</code>
                </>
              )}{" "}
              was reviewed by a language model against the source it cites, looking for <em>misformalizations</em>: places where a Lean declaration does not state the
              mathematical claim its source poses.
            </>
          )}
        </p>
        <p>
          The findings are the model's, unreviewed by a human. Each comes with the source evidence it relied on and usually a Lean experiment
          {showConfidence(m)
            ? ", and with the model's stated probability that it is a real defect"
            : ". The model also reported a probability for each finding, but it reports 1.0 for nearly everything, so those numbers are not shown"}
          ; read the findings as leads for a maintainer, not as verdicts. The run was launched on {formatDate(m.started_at)} and cost {money(m.cost_usd)}.
        </p>

        <h2>What the reviewer did</h2>
        <p>
          One agent per file, working in a sandbox holding the repository fully built at the reviewed commit, with a Lean toolchain, ripgrep and internet access through{" "}
          <code>curl</code>. The model was <code>{m.model ?? "?"}</code>
          {m.reasoning_effort ? ` at reasoning effort ${m.reasoning_effort}` : ""}, with a budget of $30 and six hours of working time per file and no limit on the number of
          steps. It was asked to read the cited source (Wikipedia, erdosproblems.com, arXiv, OEIS, papers), read every non-standard definition the statement uses, work through the
          repository's own <code>STATEMENTS.md</code> review checklist, and test boundary cases with <code>#eval</code>, <code>decide</code> and small <code>example</code> proofs.
          The sandbox also held the repository's own history of merged fixes labelled <code>misformalization</code>
          {m.n_past_examples ? ` (${m.n_past_examples} pull requests)` : ""} as worked examples, minus any fix to the file under review
          {m.n_counter_examples ? (
            <>
              , and {m.n_counter_examples} hand-written counter-examples: cases raised as misformalizations and judged not to be, each with the verdict a reviewer should have
              reported instead
            </>
          ) : null}
          . The reviewer was told not to consult the formal-conjectures GitHub repository itself, so that its findings are independent of the issue tracker.
        </p>

        <h2>What is and is not a misformalization here</h2>
        <ul>
          <li>
            <strong>Misformalization</strong>: the declaration states a claim other than the one the source poses — a different claim, a vacuous or trivially true/false
            statement, a definition with the wrong meaning. The kinds are <em>wrong statement</em>, <em>wrong definition</em> and <em>vacuous or trivial</em>.
          </li>
          <li>
            <strong>Questionable</strong>: a defensible but debatable modelling choice. <strong>Minor</strong>: a docstring or reference slip that leaves the mathematics intact.
          </li>
          <li>
            <strong>Status issues</strong> are tracked separately and not counted: a problem the source now records as solved or disproved while the file still says{" "}
            <code>research open</code>, or a contradicted <code>formal_proof</code> or answer record. The statement is the problem as posed; its tag is what is stale.
          </li>
          <li>
            <strong>Equivalent reformulations</strong> are also tracked separately: places where the Lean differs from the source in form (reindexed quantifiers, an equivalent
            characterisation, a redundant hypothesis) but was judged mathematically equivalent, often with an <code>↔</code> proved in Lean. The reviewer was told that
            equivalence is the test, not form, and that with a confident equivalence argument no misformalization is to be reported.
          </li>
        </ul>

        {trivialProofPhase && (
          <>
            <h2>Trivial proofs</h2>
            <p>
              When a review reported misformalizations, the same agent was first asked for a trivial proof or disproof: one short Lean file, kept outside the repository,
              that proves or refutes the statements as the file states them in a few lines — a proof of a supposedly open statement that the defect makes trivial, a
              disproof by counterexample, or a computation on which a definition and the intended notion disagree — something a maintainer can take in at a glance without
              reading the review. It could bail out when no defect admitted a short proof. The harness compiled each file itself (no errors, no <code>sorry</code>); the
              file pages show it.{" "}
              {trivialProofs.attempted ? (
                <>
                  Of {plural(trivialProofs.attempted, "attempt")}, {trivialProofs.compiles ?? 0} produced a compiling file and {trivialProofs.gave_up ?? 0} bailed out.
                </>
              ) : (
                <>No review reported misformalizations, so the phase never ran.</>
              )}
            </p>
          </>
        )}

        <h2>Proposed fixes</h2>
        <p>
          When a review reported misformalizations, the same agent was then asked to correct them by editing the file in place, keeping docstrings and attributes consistent
          and leaving everything else alone, and to iterate until the file compiled. It could also bail out when a fix was too hard. The harness recorded the file before and
          after and ran its own compile check; the file pages show the edit as a diff.{" "}
          {fixes.attempted ? (
            <>
              Of {plural(fixes.attempted, "attempt")}, {fixes.compiles ?? 0} produced a compiling edit and {fixes.gave_up ?? 0} bailed out. These edits are proposals, not
              reviewed patches.
            </>
          ) : (
            <>No review reported misformalizations, so no fix was attempted.</>
          )}
        </p>

        <h2>Numbers</h2>
        <ul>
          <li>
            {t.files} files reviewed, {t.submitted} with a submitted review.
          </li>
          <li>
            {plural(t.misformalizations, "misformalization")} reported in {plural(t.flagged, "file")}; {t.questionable} questionable and {t.minor} minor{" "}
            {t.questionable + t.minor === 1 ? "finding" : "findings"}; {plural(t.status_issues, "status issue")}; {plural(t.reformulations, "reformulation")} judged equivalent.
          </li>
        </ul>
        <table className="claims-table">
          <thead>
            <tr>
              <th>Collection</th>
              <th>Files</th>
              <th>Flagged</th>
              <th>Misformalizations</th>
              {hasTrivialProofs && <th>Trivial proofs</th>}
              <th>Compiling fixes</th>
              <th>Status issues</th>
            </tr>
          </thead>
          <tbody>
            {orderedCollections(m).map(([name, c]) => (
              <tr key={name}>
                <td>
                  <Link to={{ pathname: "/", search: new URLSearchParams({ c: name }).toString() }}>{name}</Link>
                </td>
                <td className="num">{c.n_files}</td>
                <td className="num">{c.n_flagged}</td>
                <td className="num">{c.n_misformalizations}</td>
                {hasTrivialProofs && <td className="num">{c.n_trivial_proof}</td>}
                <td className="num">{c.n_fixed}</td>
                <td className="num">{c.n_status_issues}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Caveats</h2>
        <ul>
          <li>There is no ground truth. Every finding is one model's reading of one source.</li>
          <li>
            The reviewer read sources online as they were on the day of the run; erdosproblems.com and Wikipedia change, and some sources were behind paywalls (the
            reviewer says so under "could not verify").
          </li>
          <li>
            Files that carry an open <code>misformalization</code> issue in the repository were reviewed like any other; the reviewer did not know which.
          </li>
        </ul>

        {m.upstream && (
          <>
            <h2>Already reported on GitHub</h2>
            <p>
              On {formatDate(m.upstream.checked_at)} the flagged files were checked against the repository: pull requests open or merged after the reviewed commit that
              carry the <code>misformalization</code> label or reference an issue that does, matched by the files they change, and open issues with that label, matched by
              the files they name. A language model then read each pull request's diff or issue's text against our findings on the file and judged whether it addresses
              the same defect. {m.upstream.n_files} of the {t.flagged} flagged files, holding {m.upstream.n_findings} of the {t.misformalizations} misformalizations, were
              already covered in full:{" "}
              <a href={m.upstream.file} target="_blank" rel="noopener noreferrer">
                {m.upstream.file}
              </a>
              , one JSON line per file with the pull requests and issues that cover it and a note on each; each such file's page links the item. The other findings
              had no report on GitHub at that time.
              {issues.length > 0 && filedOn && (
                <>
                  {" "}
                  For those, this audit filed {issues.length} issues on {formatDate(filedOn)}, one per file, each with a one-sentence summary and a link to the file's page here:{" "}
                  <a href="issues.jsonl" target="_blank" rel="noopener noreferrer">
                    issues.jsonl
                  </a>
                  ; each file's page links its issue.
                </>
              )}
            </p>
          </>
        )}

        <h2>Data and code</h2>
        <p>
          The task, prompts and exporter live on the <a href={TASK_URL} target="_blank" rel="noopener noreferrer">fc-review branch</a> of epoch-research/autoformalization; this
          site's source and data are at <a href={REPO_URL} target="_blank" rel="noopener noreferrer">tadamcz/fc-review-results</a>. Eval set <code>{m.run_id}</code>; data
          exported {formatDate(m.generated_at)}.
          {m.transcript_base && (
            <>
              {" "}
              Full transcripts of every model call, in the Inspect log viewer:{" "}
              <a href={m.transcript_base} target="_blank" rel="noopener noreferrer">
                {m.run_id}
              </a>
              ; each file page links to its own.
            </>
          )}
        </p>
        <p className="made-by">
          Made by <a href="https://tadamcz.com" target="_blank" rel="noopener noreferrer">Tom Adamczewski</a> at Epoch AI.
        </p>
      </main>
    </>
  );
}
