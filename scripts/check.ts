// Validate every run's data/<sha>/**/*.json against src/data/schema.ts and the
// cross-file invariants the site relies on. Runs first in `pnpm build`.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FileEntry, IndexFile, trivialProofCompiles } from "../src/data/schema";
import { DATA as ROOT, bareUrlRun, latestRun, listRuns } from "./runs";

const runs = listRuns();
const problems: string[] = [];

const norm = (x: unknown) => JSON.stringify(x, Object.keys(x as object).sort());

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

function checkRun(sha: string): string {
  const DATA = join(ROOT, sha);
  const problem = (msg: string) => problems.push(`${sha}: ${msg}`);
  const index = IndexFile.parse(readJson(join(DATA, "index.json")));
  const ids = index.files.map((r) => r.id).sort();
  if (new Set(ids).size !== ids.length) problem("duplicate ids in index.json");

  const onDisk = walk(join(DATA, "files"));
  if (JSON.stringify(onDisk) !== JSON.stringify(ids)) problem(`files/**.json (${onDisk.length}) != index ids (${ids.length})`);

  // the upstream check sidecar: one JSON line per file already reported or fixed upstream
  const up = index.meta.upstream;
  if (up) {
    const path = join(DATA, up.file);
    if (!existsSync(path)) problem(`meta.upstream names ${up.file}, which is missing`);
    else {
      const recs = readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const flagged = new Set(index.files.filter((r) => r.n_misformalizations > 0).map((r) => r.id));
      if (recs.length !== up.n_files) problem(`${up.file}: ${recs.length} lines, meta.upstream.n_files ${up.n_files}`);
      let nf = 0;
      for (const r of recs) {
        if (!flagged.has(r.file)) problem(`${up.file}: ${r.file} is not a flagged file of this run`);
        if (!Array.isArray(r.covered_by) || !r.covered_by.length) problem(`${up.file}: ${r.file} has no covered_by`);
        if (!Array.isArray(r.findings) || !r.findings.length) problem(`${up.file}: ${r.file} has no findings`);
        nf += (r.findings ?? []).length;
      }
      if (nf !== up.n_findings) problem(`${up.file}: ${nf} findings, meta.upstream.n_findings ${up.n_findings}`);
    }
  }

  const totals = { files: 0, submitted: 0, flagged: 0, misformalizations: 0, questionable: 0, minor: 0, status_issues: 0, reformulations: 0 };
  const fixes = { attempted: 0, changed: 0, compiles: 0, gave_up: 0 };
  const trivialProofs = { attempted: 0, written: 0, compiles: 0, gave_up: 0 };
  const collections: Record<string, { n_files: number; n_flagged: number; n_misformalizations: number; n_fixed: number; n_trivial_proof: number; n_status_issues: number }> = {};

  for (const row of index.files) {
    const path = join(DATA, "files", `${row.id}.json`);
    if (!existsSync(path)) {
      problem(`${row.id}: no files/${row.id}.json`);
      continue;
    }
    const entry = FileEntry.parse(readJson(path));
    if (entry.id !== row.id || entry.path !== row.path) problem(`${row.id}: entry id/path disagree with the index`);
    const misf = entry.review.findings.filter((f) => f.severity === "misformalization");
    if (misf.length !== row.n_misformalizations) problem(`${row.id}: n_misformalizations ${row.n_misformalizations} != ${misf.length} findings`);
    if (entry.review.status_issues.length !== row.n_status_issues) problem(`${row.id}: n_status_issues disagrees`);
    if (entry.review.reformulations.length !== row.n_reformulations) problem(`${row.id}: n_reformulations disagrees`);
    if (entry.fix.changed !== (entry.fix.after !== null)) problem(`${row.id}: fix.after present iff changed violated`);
    if (entry.fix.changed && entry.fix.after === entry.lean) problem(`${row.id}: fix.changed but after == lean`);
    if (entry.fix.attempted && misf.length === 0) problem(`${row.id}: fix attempted without misformalizations`);
    const tp = entry.trivial_proof;
    if (tp.attempted && misf.length === 0) problem(`${row.id}: trivial proof attempted without misformalizations`);
    if (tp.written !== (tp.lean !== null)) problem(`${row.id}: trivial_proof.lean present iff written violated`);
    if (tp.n_demonstrated !== (tp.submission?.demonstrated.length ?? 0)) problem(`${row.id}: trivial_proof.n_demonstrated disagrees with the submission`);
    const { compile_errors: _e, limit_hit: _l, submission: _s, checkout_modified: _c, lean: _t, ...tpRow } = tp;
    if (norm(row.trivial_proof) !== norm(tpRow)) problem(`${row.id}: row.trivial_proof disagrees with the entry`);
    if (!entry.lean.trim()) problem(`${row.id}: empty lean text`);
    for (const f of entry.review.findings) if (f.confidence < 0 || f.confidence > 1) problem(`${row.id}: confidence out of range`);

    totals.files++;
    totals.submitted += Number(row.submitted);
    totals.flagged += Number(misf.length > 0);
    totals.misformalizations += misf.length;
    totals.questionable += row.n_questionable;
    totals.minor += row.n_minor;
    totals.status_issues += row.n_status_issues;
    totals.reformulations += row.n_reformulations;
    if (tp.attempted) {
      trivialProofs.attempted++;
      trivialProofs.written += Number(tp.written);
      trivialProofs.compiles += Number(trivialProofCompiles(tp));
      trivialProofs.gave_up += Number(tp.gave_up);
    }
    if (row.fix.attempted) {
      fixes.attempted++;
      fixes.changed += Number(row.fix.changed);
      fixes.compiles += Number(row.fix.changed && row.fix.compile_ok === true);
      fixes.gave_up += Number(row.fix.gave_up);
    }
    const c = (collections[row.collection] ??= { n_files: 0, n_flagged: 0, n_misformalizations: 0, n_fixed: 0, n_trivial_proof: 0, n_status_issues: 0 });
    c.n_files++;
    c.n_flagged += Number(misf.length > 0);
    c.n_misformalizations += misf.length;
    c.n_fixed += Number(row.fix.changed && row.fix.compile_ok === true);
    c.n_trivial_proof += Number(trivialProofCompiles(tp));
    c.n_status_issues += row.n_status_issues;
  }

  for (const [k, v] of Object.entries(totals)) if (index.meta.totals[k] !== v) problem(`meta.totals.${k}=${index.meta.totals[k]} but rows give ${v}`);
  for (const [k, v] of Object.entries(fixes)) if ((index.meta.fix[k] ?? 0) !== v) problem(`meta.fix.${k}=${index.meta.fix[k]} but rows give ${v}`);
  for (const [k, v] of Object.entries(trivialProofs)) if ((index.meta.trivial_proof[k] ?? 0) !== v) problem(`meta.trivial_proof.${k}=${index.meta.trivial_proof[k]} but rows give ${v}`);
  for (const [name, c] of Object.entries(collections)) {
    if (!index.meta.collections[name]) problem(`meta.collections lacks ${name}`);
    else if (norm(index.meta.collections[name]) !== norm(c)) problem(`meta.collections.${name} disagrees with the rows`);
  }
  for (const name of Object.keys(index.meta.collections)) if (!collections[name]) problem(`meta.collections.${name} has no rows`);

  return `${ids.length} files, ${totals.misformalizations} misformalizations in ${totals.flagged}, ${trivialProofs.compiles} with a compiling trivial proof, ${fixes.compiles} compiling fixes`;
}

const summaries = runs.map((run) => `${run.sha} (${run.started_at.slice(0, 10)}): ${checkRun(run.sha)}`);
if (problems.length) {
  console.error(`${problems.length} problem(s):\n  ${problems.slice(0, 40).join("\n  ")}`);
  process.exit(1);
}
console.log(`ok: ${runs.length} run(s), bare URL -> ${bareUrlRun(runs).sha}, latest -> ${latestRun(runs).sha}\n  ${summaries.join("\n  ")}`);
