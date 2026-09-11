import { formatDate, relativeDate } from "../data/filters";
import { useSwitchToLatest } from "../data/load";

// " (4 days ago · switch to latest run)" after a commit sha: the age, worked out when rendered so
// it stays right as the page ages, with the exact date on hover; and, when the run shown is not
// the latest full run, a link to the one that is. Nothing when neither applies (data exported
// before the commit date was recorded, on the latest run).
export function CommitAge({ date, prefix = "" }: { date: string | null; prefix?: string }) {
  const latest = useSwitchToLatest();
  if (!date && !latest) return null;
  return (
    <>
      {" "}
      (
      {date && (
        <time dateTime={date} title={formatDate(date)}>
          {prefix}
          {relativeDate(date)}
        </time>
      )}
      {date && latest && " · "}
      {latest && (
        <a href={`../${latest}/`} title={`A newer full audit exists, at ${latest}`}>
          switch to latest run
        </a>
      )}
      )
    </>
  );
}
