// Validate data/**/*.json against src/data/schema.ts and the cross-file
// invariants the site relies on. Runs first in `pnpm build`.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FileEntry, IndexFile } from "../src/data/schema";

const DATA = join(process.cwd(), "data");
const problems: string[] = [];

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walk(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, `${prefix}${name}/`));
    else if (name.endsWith(".json")) out.push(`${prefix}${name.slice(0, -5)}`);
  }
  return out.sort();
}

const index = IndexFile.parse(readJson(join(DATA, "index.json")));
const ids = index.files.map((r) => r.id).sort();
if (new Set(ids).size !== ids.length) problems.push("duplicate ids in index.json");

const onDisk = walk(join(DATA, "files"));
if (JSON.stringify(onDisk) !== JSON.stringify(ids)) problems.push(`files/**.json (${onDisk.length}) != index ids (${ids.length})`);

const totals = { files: 0, submitted: 0, flagged: 0, misformalizations: 0, questionable: 0, minor: 0, status_issues: 0, reformulations: 0 };
const fixes = { attempted: 0, changed: 0, compiles: 0, gave_up: 0 };
const collections: Record<string, { n_files: number; n_flagged: number; n_misformalizations: number; n_fixed: number; n_status_issues: number }> = {};

for (const row of index.files) {
  const path = join(DATA, "files", `${row.id}.json`);
  if (!existsSync(path)) {
    problems.push(`${row.id}: no files/${row.id}.json`);
    continue;
  }
  const entry = FileEntry.parse(readJson(path));
  if (entry.id !== row.id || entry.path !== row.path) problems.push(`${row.id}: entry id/path disagree with the index`);
  const misf = entry.review.findings.filter((f) => f.severity === "misformalization");
  if (misf.length !== row.n_misformalizations) problems.push(`${row.id}: n_misformalizations ${row.n_misformalizations} != ${misf.length} findings`);
  if (entry.review.status_issues.length !== row.n_status_issues) problems.push(`${row.id}: n_status_issues disagrees`);
  if (entry.review.reformulations.length !== row.n_reformulations) problems.push(`${row.id}: n_reformulations disagrees`);
  if (entry.fix.changed !== (entry.fix.after !== null)) problems.push(`${row.id}: fix.after present iff changed violated`);
  if (entry.fix.changed && entry.fix.after === entry.lean) problems.push(`${row.id}: fix.changed but after == lean`);
  if (entry.fix.attempted && misf.length === 0) problems.push(`${row.id}: fix attempted without misformalizations`);
  if (!entry.lean.trim()) problems.push(`${row.id}: empty lean text`);
  for (const f of entry.review.findings) if (f.confidence < 0 || f.confidence > 1) problems.push(`${row.id}: confidence out of range`);

  totals.files++;
  totals.submitted += Number(row.submitted);
  totals.flagged += Number(misf.length > 0);
  totals.misformalizations += misf.length;
  totals.questionable += row.n_questionable;
  totals.minor += row.n_minor;
  totals.status_issues += row.n_status_issues;
  totals.reformulations += row.n_reformulations;
  if (row.fix.attempted) {
    fixes.attempted++;
    fixes.changed += Number(row.fix.changed);
    fixes.compiles += Number(row.fix.changed && row.fix.compile_ok === true);
    fixes.gave_up += Number(row.fix.gave_up);
  }
  const c = (collections[row.collection] ??= { n_files: 0, n_flagged: 0, n_misformalizations: 0, n_fixed: 0, n_status_issues: 0 });
  c.n_files++;
  c.n_flagged += Number(misf.length > 0);
  c.n_misformalizations += misf.length;
  c.n_fixed += Number(row.fix.changed && row.fix.compile_ok === true);
  c.n_status_issues += row.n_status_issues;
}

const norm = (x: unknown) => JSON.stringify(x, Object.keys(x as object).sort());
for (const [k, v] of Object.entries(totals)) if (index.meta.totals[k] !== v) problems.push(`meta.totals.${k}=${index.meta.totals[k]} but rows give ${v}`);
for (const [k, v] of Object.entries(fixes)) if ((index.meta.fix[k] ?? 0) !== v) problems.push(`meta.fix.${k}=${index.meta.fix[k]} but rows give ${v}`);
for (const [name, c] of Object.entries(collections)) {
  if (!index.meta.collections[name]) problems.push(`meta.collections lacks ${name}`);
  else if (norm(index.meta.collections[name]) !== norm(c)) problems.push(`meta.collections.${name} disagrees with the rows`);
}
for (const name of Object.keys(index.meta.collections)) if (!collections[name]) problems.push(`meta.collections.${name} has no rows`);

if (problems.length) {
  console.error(`${problems.length} problem(s):\n  ${problems.slice(0, 40).join("\n  ")}`);
  process.exit(1);
}
console.log(`ok: ${ids.length} files, ${totals.misformalizations} misformalizations in ${totals.flagged}, ${fixes.compiles} compiling fixes`);
