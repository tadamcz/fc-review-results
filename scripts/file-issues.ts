// Files one GitHub issue per flagged file of a run whose misformalizations nobody has reported on
// google-deepmind/formal-conjectures — the run's flagged files minus those in its upstream.jsonl —
// from the reviewed drafts in issues/<sha>/drafts.jsonl, and records what it created in
// issues/<sha>/created.jsonl so that a re-run never files a file twice.
//
//   pnpm run issues -- --run c90271f0fa         dry run: validates the drafts against the run, checks the
//                                           labels exist, writes issues/<sha>/preview.md, creates nothing
//   pnpm run issues -- --run c90271f0fa --create   files the issues and their "Related:" comments, pausing
//                                           --sleep ms (default 2500) between requests
//   --limit N            create at most N issues in this invocation (a staged rollout)
//   --only id[,id...]    restrict to these file ids
//   --repo owner/name    default google-deepmind/formal-conjectures (a fork, to test the rendering)
//
// An issue: title "<file id>: <draft title>"; body = the draft's one-sentence summary, the file's page on
// the site, bullets mirroring the file page's summary band (the counts, the trivial-proof outcome, the fix
// outcome), a provenance footnote. Labels: misformalization, ai-audit, ai-audit-<sha>; all three must
// exist in the repository, or the script stops before touching anything. A draft with related_comments
// gets one comment on the new issue pointing at the existing pull request or issue.
//
// drafts.jsonl, one line per file: {"file", "title" (the gist, without the file id), "summary" (one
// sentence), "related_comments": [{"number", "type": "pr"|"issue", "comment"}]}. It must cover exactly the
// flagged files not already reported upstream; anything else is an error.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { fixLabel, summaryParts, trivialProofLabel } from "../src/data/labels";
import { FileEntry, IndexFile, UpstreamRecord } from "../src/data/schema";
import { DATA, SHA } from "./runs";

const SITE = "https://tadamcz.com/fc-review-results";
const REPO_DEFAULT = "google-deepmind/formal-conjectures";
const ISSUES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "issues");

const Draft = z.object({
  file: z.string(),
  title: z.string().min(1).max(200),
  summary: z.string().min(1),
  related_comments: z.array(z.object({ number: z.number(), type: z.enum(["pr", "issue"]), comment: z.string().min(1) })).default([]),
});
type Draft = z.infer<typeof Draft>;
const Created = z.object({ file: z.string(), number: z.number(), url: z.string(), created_at: z.string(), comment_url: z.string().nullable() });
type Created = z.infer<typeof Created>;

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
const flag = (name: string) => process.argv.includes(name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }).trim();
}

function readJsonl<T>(path: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => schema.parse(JSON.parse(l)));
}

async function main() {
  const sha = arg("--run");
  if (!sha || !SHA.test(sha)) throw new Error("--run <the run's ten-character fc sha> is required");
  const repo = arg("--repo") ?? REPO_DEFAULT;
  const create = flag("--create");
  const limit = arg("--limit") ? Number(arg("--limit")) : Infinity;
  const only = arg("--only") ? new Set(arg("--only")!.split(",")) : null;
  const sleepMs = arg("--sleep") ? Number(arg("--sleep")) : 2500;
  const labels = ["misformalization", "ai-audit", `ai-audit-${sha}`];

  // the run: flagged files, minus those already reported or fixed upstream
  const runDir = join(DATA, sha);
  const index = IndexFile.parse(JSON.parse(readFileSync(join(runDir, "index.json"), "utf8")));
  const covered = new Set(index.meta.upstream ? readJsonl(join(runDir, index.meta.upstream.file), UpstreamRecord).map((r) => r.file) : []);
  const flagged = index.files.filter((r) => r.n_misformalizations > 0).map((r) => r.id);
  const all = flagged.filter((id) => !covered.has(id)).sort();

  // the drafts must cover exactly that set
  const dir = join(ISSUES_DIR, sha);
  mkdirSync(dir, { recursive: true });
  const drafts = new Map(readJsonl(join(dir, "drafts.jsonl"), Draft).map((d) => [d.file, d]));
  const missing = all.filter((t) => !drafts.has(t));
  const extra = [...drafts.keys()].filter((f) => !all.includes(f));
  if (missing.length || extra.length) {
    const show = (xs: string[]) => xs.slice(0, 5).join(", ") + (xs.length > 5 ? ", …" : "");
    throw new Error(
      `issues/${sha}/drafts.jsonl must cover exactly the ${all.length} flagged files not already reported upstream: ` +
        `${missing.length} missing (${show(missing)}), ${extra.length} extra (${show(extra)})`,
    );
  }
  const targets = only ? all.filter((t) => only.has(t)) : all;

  // the labels must exist, before anything else
  const absent = labels.filter((l) => {
    try {
      gh(["api", `repos/${repo}/labels/${encodeURIComponent(l)}`]);
      return false;
    } catch {
      return true;
    }
  });
  if (absent.length) throw new Error(`label(s) missing in ${repo}: ${absent.join(", ")} — create them first`);

  // what exists already: our record, plus anything on GitHub carrying the run label whose title starts
  // with the file id (an issue created by an earlier invocation that died before recording it)
  const createdPath = join(dir, "created.jsonl");
  const created = new Map(readJsonl(createdPath, Created).map((c) => [c.file, c]));
  const onGitHub = JSON.parse(
    gh(["issue", "list", "--repo", repo, "--label", `ai-audit-${sha}`, "--state", "all", "--limit", "1000", "--json", "number,title,url,createdAt"]),
  ) as { number: number; title: string; url: string; createdAt: string }[];
  for (const t of all) {
    if (created.has(t)) continue;
    const hit = onGitHub.find((i) => i.title.startsWith(`${t}: `));
    if (hit) {
      const rec: Created = { file: t, number: hit.number, url: hit.url, created_at: hit.createdAt, comment_url: null };
      created.set(t, rec);
      appendFileSync(createdPath, JSON.stringify(rec) + "\n");
      console.log(`already on GitHub, recorded: ${t} -> #${hit.number}`);
    }
  }

  const render = (file: string) => {
    const draft = drafts.get(file)!;
    const entry = FileEntry.parse(JSON.parse(readFileSync(join(runDir, "files", `${file}.json`), "utf8")));
    const bullets = [...summaryParts(entry), trivialProofLabel(entry.trivial_proof)?.text, fixLabel(entry.fix)?.text].filter((x): x is string => Boolean(x));
    const title = `${file}: ${draft.title}`;
    if (title.length > 256) throw new Error(`${file}: title longer than GitHub allows (${title.length})`);
    const body =
      [
        draft.summary,
        "",
        `${SITE}/${sha}/#/f/${file}`,
        "",
        ...bullets.map((b) => `- ${b}`),
        "",
        `<sub>Found by a language-model audit of the repository at ${sha}; this issue's title and description were written by a language model as well. Not reviewed by a human.</sub>`,
      ].join("\n") + "\n";
    const comment = draft.related_comments.length ? draft.related_comments.map((c) => c.comment).join("\n\n") + "\n" : null;
    return { title, body, comment };
  };

  // the preview, every target, whether created or not
  const preview: string[] = [`# Issues for ${sha} on ${repo}`, "", `${targets.length} files; ${targets.filter((t) => created.has(t)).length} already created.`, ""];
  for (const t of targets) {
    const { title, body, comment } = render(t);
    const c = created.get(t);
    preview.push(`## ${title}`, "", c ? `_created: ${c.url}_` : "_not created_", "", body, ...(comment ? ["**Comment on the issue:**", "", comment] : []), "---", "");
  }
  writeFileSync(join(dir, "preview.md"), preview.join("\n"));
  const todo = targets.filter((t) => !created.has(t));
  console.log(`${all.length} files to report for ${sha}; ${targets.length} selected; ${targets.length - todo.length} created already; ${todo.length} to create. Preview: issues/${sha}/preview.md`);
  if (!create) return;

  // create, recording each issue the moment it exists
  let n = 0;
  const bodyFile = join(tmpdir(), `fc-issue-${process.pid}.md`);
  for (const t of todo) {
    if (n >= limit) break;
    const { title, body, comment } = render(t);
    writeFileSync(bodyFile, body);
    const out = gh(["issue", "create", "--repo", repo, "--title", title, "--body-file", bodyFile, ...labels.flatMap((l) => ["--label", l])]);
    const url = out.split("\n").pop()!.trim();
    const number = Number(url.split("/").pop());
    if (!Number.isInteger(number)) throw new Error(`could not read the issue number from gh's output: ${out}`);
    let rec: Created = { file: t, number, url, created_at: new Date().toISOString(), comment_url: null };
    created.set(t, rec);
    appendFileSync(createdPath, JSON.stringify(rec) + "\n");
    console.log(`created #${number}: ${title}`);
    n++;
    if (comment) {
      await sleep(sleepMs);
      writeFileSync(bodyFile, comment);
      const commentUrl = gh(["issue", "comment", String(number), "--repo", repo, "--body-file", bodyFile]).split("\n").pop()!.trim();
      rec = { ...rec, comment_url: commentUrl };
      created.set(t, rec);
      writeFileSync(createdPath, [...created.values()].map((c) => JSON.stringify(c)).join("\n") + "\n");
      console.log(`  commented: ${commentUrl}`);
    }
    await sleep(sleepMs);
  }
  console.log(`done: ${n} created this run; ${todo.length - n} remaining`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
