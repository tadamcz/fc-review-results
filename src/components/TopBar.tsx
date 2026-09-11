import { Link } from "react-router";
import { useIndex, useRuns } from "../data/load";
import { runScope } from "../data/schema";

export const SITE_NAME = "Formal Conjectures audit";

export function TopBar({ children }: { children?: React.ReactNode }) {
  const index = useIndex();
  const runs = useRuns();
  const meta = index.status === "ok" ? index.data.meta : null;
  const subset = meta ? runScope(meta).subset : false; // a run over a selection of files, not the whole tree
  // the latest full run, when this page is not it: a pull-request review or an earlier audit
  const latest = meta && runs.status === "ok" && runs.data.latest !== meta.fc_commit.slice(0, 10) ? runs.data.latest : null;
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          {SITE_NAME}
        </Link>
        <span className="topbar-desc">
          {subset ? "A selection of formal-conjectures files" : "Every file of formal-conjectures"} reviewed against its source by a language model. Findings for review, not
          verdicts.
        </span>
        <nav className="topbar-nav">
          {children}
          {latest && (
            <a href={`../${latest}/`} title={`This page is not the latest full audit; that is the run at ${latest}`}>
              switch to latest run
            </a>
          )}
          <Link to="/about">About</Link>
        </nav>
      </div>
    </header>
  );
}
