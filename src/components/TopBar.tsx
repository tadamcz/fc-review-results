import { Link } from "react-router";
import { useIndex } from "../data/load";
import { runScope } from "../data/schema";

export const SITE_NAME = "Formal Conjectures audit";

export function TopBar({ children }: { children?: React.ReactNode }) {
  const index = useIndex();
  const subset = index.status === "ok" && runScope(index.data.meta).subset; // a run over a selection of files, not the whole tree
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
          <Link to="/about">About</Link>
        </nav>
      </div>
    </header>
  );
}
