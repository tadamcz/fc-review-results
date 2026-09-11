// The data tree holds one run per reviewed formal-conjectures commit:
// data/<sha>/index.json and data/<sha>/files/**, where <sha> is the first ten
// characters of the commit (as the pages show it). The built site serves the
// app once per run at <site>/<sha>/ next to that run's data, and the bare
// <site>/ is a permanent alias of one run, BARE_URL_RUN: the first run's links
// were <site>/#/f/<id> and are posted around GitHub, so they must keep
// resolving to that run's findings. The alias never moves to a newer run.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
export const SHORT = 10;
export const SHA = /^[0-9a-f]{10}$/;
export const shortSha = (commit: string) => commit.slice(0, SHORT);

// The run the bare <site>/ redirects to: the one that existed before runs were
// versioned. Fixed for good — changing it would point every link made from that
// run at another run's findings.
export const BARE_URL_RUN = "84063d6942";

export type Run = { sha: string; started_at: string };

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
    runs.push({ sha: name, started_at: meta.started_at });
  }
  if (!runs.length) throw new Error("data/ holds no runs");
  return runs.sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at) || a.sha.localeCompare(b.sha));
}

export function bareUrlRun(runs = listRuns()): Run {
  const run = runs.find((r) => r.sha === BARE_URL_RUN);
  if (!run) throw new Error(`data/${BARE_URL_RUN}/ is missing, but the bare <site>/ redirects to it`);
  return run;
}

// The page at the site root. Old links are <site>/#/f/<id>; the hash router's
// route (and the list's filters, which live in the hash too) is carried over
// to <site>/<sha>/. The meta refresh is only for browsers without JavaScript:
// it cannot carry the hash, and outside <noscript> its navigation could race
// the script's and drop the route.
export function redirectHtml(sha: string): string {
  const target = `./${sha}/`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <title>Formal Conjectures audit</title>
    <script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
    <noscript><meta http-equiv="refresh" content="0; url=${target}" /></noscript>
  </head>
  <body>
    <p>Redirecting to the <a href="${target}">audit</a>…</p>
  </body>
</html>
`;
}
