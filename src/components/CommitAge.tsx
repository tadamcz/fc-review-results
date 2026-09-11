import { formatDate, relativeDate } from "../data/filters";

// " (4 days ago)" after a commit sha, worked out when rendered so it stays right as the page
// ages; the exact date on hover. Nothing for data exported before the commit date was recorded.
export function CommitAge({ date, prefix = "" }: { date: string | null; prefix?: string }) {
  if (!date) return null;
  return (
    <>
      {" "}
      (
      <time dateTime={date} title={formatDate(date)}>
        {prefix}
        {relativeDate(date)}
      </time>
      )
    </>
  );
}
