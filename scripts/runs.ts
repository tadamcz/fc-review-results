// The data tree holds one run per reviewed formal-conjectures commit:
// data/<sha>/index.json and data/<sha>/files/**, where <sha> is the first ten
// characters of the commit (as the pages show it). The built site serves the
// app once per run at <site>/<sha>/ next to that run's data, plus two redirect
// pages and a run list. The bare <site>/ goes to the latest full run when it
// carries no route, and to BARE_URL_RUN when it carries one: the first run's
// links were <site>/#/f/<id> and are posted around GitHub, so a hash route on
// the bare URL must keep resolving to that run's findings, for good.
// <site>/latest/ goes to the latest full run; <site>/runs.json lists the runs,
// so a page can tell whether it is the latest and offer to switch.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
export const SHORT = 10;
export const SHA = /^[0-9a-f]{10}$/;
export const shortSha = (commit: string) => commit.slice(0, SHORT);

// The run an old deep link on the bare <site>/ (a hash route, <site>/#/f/<id>) refers to: the
// one that existed before runs were versioned. Fixed for good — changing it would point every
// link made from that run at another run's findings.
export const BARE_URL_RUN = "84063d6942";

export type Run = {
  sha: string;
  fc_commit: string;
  fc_commit_date: string | null; // committer date of the reviewed commit; null in data exported before it was recorded
  started_at: string;
  files: number;
  // a named selection of files (task args files/collections) rather than the whole tree — a
  // pull-request review, say. Never "the latest run", however recent. (The log records
  // unset args as null, hence the truthiness test.)
  subset: boolean;
};

// oldest first; throws on a malformed tree so the build fails loudly
export function listRuns(): Run[] {
  const runs: Run[] = [];
  for (const name of readdirSync(DATA)) {
    if (name.startsWith(".")) continue; // .DS_Store
    if (!statSync(join(DATA, name)).isDirectory()) throw new Error(`data/${name}: runs live in data/<short fc sha>/`);
    if (!SHA.test(name)) throw new Error(`data/${name}/: not a ${SHORT}-character commit sha`);
    const path = join(DATA, name, "index.json");
    if (!existsSync(path)) throw new Error(`data/${name}/: no index.json`);
    const meta = JSON.parse(readFileSync(path, "utf8")).meta;
    if (typeof meta.fc_commit !== "string" || shortSha(meta.fc_commit) !== name) throw new Error(`data/${name}/: meta.fc_commit is ${meta.fc_commit}`);
    if (typeof meta.started_at !== "string" || Number.isNaN(Date.parse(meta.started_at))) throw new Error(`data/${name}/: bad meta.started_at`);
    if (meta.fc_commit_date != null && (typeof meta.fc_commit_date !== "string" || Number.isNaN(Date.parse(meta.fc_commit_date))))
      throw new Error(`data/${name}/: bad meta.fc_commit_date`);
    const args = meta.task_args ?? {};
    runs.push({
      sha: name,
      fc_commit: meta.fc_commit,
      fc_commit_date: meta.fc_commit_date ?? null,
      started_at: meta.started_at,
      files: meta.totals?.files ?? 0,
      subset: Boolean(args.files) || Boolean(args.collections),
    });
  }
  if (!runs.length) throw new Error("data/ holds no runs");
  return runs.sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at) || a.sha.localeCompare(b.sha));
}

export function bareUrlRun(runs = listRuns()): Run {
  const run = runs.find((r) => r.sha === BARE_URL_RUN);
  if (!run) throw new Error(`data/${BARE_URL_RUN}/ is missing, but the bare <site>/ redirects to it`);
  return run;
}

// The latest full run: what <site>/latest/ redirects to and what the other runs' pages offer
// to switch to. Runs over a selection of files (pull-request reviews) are never the latest.
export function latestRun(runs = listRuns()): Run {
  const full = runs.filter((r) => !r.subset);
  if (!full.length) throw new Error("data/ holds no run over the whole tree");
  return full[full.length - 1];
}

// <site>/runs.json: what a page needs to place itself among the runs
export function runsJson(runs = listRuns()): string {
  return JSON.stringify({ latest: latestRun(runs).sha, runs }, null, 1) + "\n";
}

// A redirect page. Links carry the hash router's route (and the list's filters, which live
// in the hash too), and the script carries it over to the target, a URL relative to the page:
// ./<sha>/ from the site root, ../<sha>/ from <site>/latest/. The meta refresh is only for
// browsers without JavaScript: it cannot carry the hash, and outside <noscript> its
// navigation could race the script's and drop the route.
function redirectPage(script: string, fallback: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <title>Formal Conjectures audit</title>
    <script>${script}</script>
    <noscript><meta http-equiv="refresh" content="0; url=${fallback}" /></noscript>
  </head>
  <body>
    <p>Redirecting to the <a href="${fallback}">audit</a>…</p>
  </body>
</html>
`;
}

// <site>/latest/ and the like: one fixed target
export function redirectHtml(target: string): string {
  return redirectPage(`location.replace(${JSON.stringify(target)} + location.search + location.hash);`, target);
}

// The site root: a hash route (anything beyond "#" or "#/") is an old deep link and goes to
// BARE_URL_RUN's run; a bare address goes to the latest full run, as does the no-JavaScript
// fallback, which cannot see the hash.
export function rootRedirectHtml(deepLinkTarget: string, latestTarget: string): string {
  const script =
    `var h = location.hash; var deep = h && h !== "#" && h !== "#/"; ` +
    `location.replace((deep ? ${JSON.stringify(deepLinkTarget)} : ${JSON.stringify(latestTarget)}) + location.search + h);`;
  return redirectPage(script, latestTarget);
}
