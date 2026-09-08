import { Link } from "react-router";

export const SITE_NAME = "Formal Conjectures audit";

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          {SITE_NAME}
        </Link>
        <span className="topbar-desc">Every file of formal-conjectures reviewed against its source by a language model. Findings for review, not verdicts.</span>
        <nav className="topbar-nav">
          {children}
          <Link to="/about">About</Link>
        </nav>
      </div>
    </header>
  );
}
