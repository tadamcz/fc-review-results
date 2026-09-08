import { useEffect } from "react";
import { Link } from "react-router";
import { TopBar } from "../components/TopBar";
import { formatDate, money } from "../data/filters";
import { useIndex } from "../data/load";
import { orderedCollections } from "./ListPage";

const REPO_URL = "https://github.com/tadamcz/fc-review-results";
const TASK_URL = "https://github.com/epoch-research/autoformalization/tree/fc-review";

export function AboutPage() {
  const index = useIndex();
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
  return (
    <>
      <TopBar />
      <main className="page narrow about">
        <h1>About</h1>
        <p>
          This site shows the results of an automated audit of{" "}
          <a href={m.fc_repo_url} target="_blank" rel="noopener noreferrer">
            google-deepmind/formal-conjectures
          </a>{" "}
          at commit{" "}
          <a href={m.fc_tree_url} target="_blank" rel="noopener noreferrer">
            <code>{m.fc_commit.slice(0, 10)}</code>
          </a>
          . Every one of its {t.files} Lean files — the problem statements under <code>FormalConjectures/</code> and the reusable definitions under{" "}
          <code>FormalConjecturesForMathlib/</code> — was reviewed by a language model against the source it cites, looking for <em>misformalizations</em>: places where a Lean
          declaration does not state the mathematical claim its source poses.
        </p>
        <p>
          The findings are the model's, unreviewed by a human. Each comes with the model's stated probability that it is a real defect, the source evidence it relied on, and
          usually a Lean experiment; read them as leads for a maintainer, not as verdicts. The run was launched on {formatDate(m.started_at)} and cost {money(m.cost_usd)}.
        </p>

        <h2>What the reviewer did</h2>
        <p>
          One agent per file, working in a sandbox holding the repository fully built at the reviewed commit, with a Lean toolchain, ripgrep and internet access through{" "}
          <code>curl</code>. The model was <code>{m.model ?? "?"}</code>
          {m.reasoning_effort ? ` at reasoning effort ${m.reasoning_effort}` : ""}, with a budget of $30 and six hours of working time per file and no limit on the number of
          steps. It was asked to read the cited source (Wikipedia, erdosproblems.com, arXiv, OEIS, papers), read every non-standard definition the statement uses, work through the
          repository's own <code>STATEMENTS.md</code> review checklist, and test boundary cases with <code>#eval</code>, <code>decide</code> and small <code>example</code> proofs.
          The sandbox also held the repository's own history of merged fixes labelled <code>misformalization</code> ({t.files ? "285 pull requests" : ""}) as worked examples,
          minus any fix to the file under review. The reviewer was told not to consult the formal-conjectures GitHub repository itself, so that its findings are independent of the
          issue tracker.
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

        <h2>Proposed fixes</h2>
        <p>
          When a review reported misformalizations, the same agent was then asked to correct them by editing the file in place, keeping docstrings and attributes consistent
          and leaving everything else alone, and to iterate until the file compiled. It could also bail out when a fix was too hard. The harness recorded the file before and
          after and ran its own compile check; the file pages show the edit as a diff. Of {fixes.attempted ?? 0} attempts, {fixes.compiles ?? 0} produced a compiling edit and{" "}
          {fixes.gave_up ?? 0} bailed out. These edits are proposals, not reviewed patches.
        </p>

        <h2>Numbers</h2>
        <ul>
          <li>
            {t.files} files reviewed, {t.submitted} with a submitted review.
          </li>
          <li>
            {t.misformalizations} misformalizations reported in {t.flagged} files; {t.questionable} questionable and {t.minor} minor findings; {t.status_issues} status issues;{" "}
            {t.reformulations} reformulations judged equivalent.
          </li>
        </ul>
        <table className="claims-table">
          <thead>
            <tr>
              <th>Collection</th>
              <th>Files</th>
              <th>Flagged</th>
              <th>Misformalizations</th>
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
                <td className="num">{c.n_fixed}</td>
                <td className="num">{c.n_status_issues}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Caveats</h2>
        <ul>
          <li>There is no ground truth. A finding at probability 1.0 is still one model's reading of one source.</li>
          <li>
            The reviewer read sources online as they were on the day of the run; erdosproblems.com and Wikipedia change, and some sources were behind paywalls (the
            reviewer says so under "could not verify").
          </li>
          <li>
            Files that carry an open <code>misformalization</code> issue in the repository were reviewed like any other; the reviewer did not know which.
          </li>
        </ul>

        <h2>Data and code</h2>
        <p>
          The task, prompts and exporter live on the <a href={TASK_URL} target="_blank" rel="noopener noreferrer">fc-review branch</a> of epoch-research/autoformalization; this
          site's source and data are at <a href={REPO_URL} target="_blank" rel="noopener noreferrer">tadamcz/fc-review-results</a>. Eval set <code>{m.run_id}</code>
          {m.viewer_url && (
            <>
              {" "}
              (<a href={m.viewer_url} target="_blank" rel="noopener noreferrer">transcripts</a>)
            </>
          )}
          ; data exported {formatDate(m.generated_at)}.
        </p>
        <p className="made-by">
          Made by <a href="https://tadamcz.com" target="_blank" rel="noopener noreferrer">Tom Adamczewski</a> at Epoch AI.
        </p>
      </main>
    </>
  );
}
