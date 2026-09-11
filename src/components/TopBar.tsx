import { Link } from "react-router";
import { useSwitchToLatest } from "../data/load";

export const SITE_NAME = "Formal Conjectures audit";

export function TopBar({ children }: { children?: React.ReactNode }) {
  const latest = useSwitchToLatest(); // the latest full run, when this page is not it
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          {SITE_NAME}
        </Link>
        <span className="topbar-desc">Language model audit of google-deepmind/formal-conjectures</span>
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
