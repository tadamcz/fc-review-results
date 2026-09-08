// <details> with a consistent summary; `open` is uncontrolled unless given.
export function Disclosure({ summary, children, open, className }: { summary: React.ReactNode; children: React.ReactNode; open?: boolean; className?: string }) {
  return (
    <details className={`disclosure ${className ?? ""}`} open={open}>
      <summary>{summary}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
