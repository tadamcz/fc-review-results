// zod schemas for the exporter's JSON (autoformalization/review_site/export.py
// is the producer; scripts/check.ts validates data/** against these at build).
import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const Severity = z.enum(["misformalization", "questionable", "minor"]);
export type Severity = z.infer<typeof Severity>;

export const Finding = z.object({
  declaration: z.string(),
  severity: Severity,
  kind: z.string(),
  description: z.string(),
  source_evidence: z.string().default(""),
  suggested_fix: z.string().default(""),
  confidence: z.number(),
  line: z.number().nullable().default(null),
});
export type Finding = z.infer<typeof Finding>;

export const StatusIssue = z.object({
  declaration: z.string(),
  recorded: z.string().default(""),
  source_status: z.string(),
  evidence: z.string().default(""),
  suggested_change: z.string().default(""),
  confidence: z.number(),
  line: z.number().nullable().default(null),
});
export type StatusIssue = z.infer<typeof StatusIssue>;

export const Reformulation = z.object({
  declaration: z.string(),
  difference: z.string(),
  equivalence_argument: z.string().default(""),
  proved_in_lean: z.boolean().default(false),
  confidence: z.number(),
  line: z.number().nullable().default(null),
});
export type Reformulation = z.infer<typeof Reformulation>;

export const FixRow = z.object({
  attempted: z.boolean(),
  changed: z.boolean(),
  compile_ok: z.boolean().nullable(),
  gave_up: z.boolean(),
});
export type FixRow = z.infer<typeof FixRow>;

// The trivial-proof phase: one short Lean file, outside the checkout, proving or
// refuting the misformalized statements as the file states them. Runs from
// before the phase existed carry no `trivial_proof`: the defaults below stand in.
export const TrivialProofRow = z.object({
  attempted: z.boolean(),
  written: z.boolean(),
  compile_ok: z.boolean().nullable(),
  sorry_free: z.boolean().nullable(),
  gave_up: z.boolean(),
  n_demonstrated: z.number(),
});
export type TrivialProofRow = z.infer<typeof TrivialProofRow>;
export const NO_TRIVIAL_PROOF: TrivialProofRow = { attempted: false, written: false, compile_ok: null, sorry_free: null, gave_up: false, n_demonstrated: 0 };

// a trivial proof a reader can trust: the file exists, compiles, and proves without sorry
export const trivialProofCompiles = (e: TrivialProofRow) => e.written && e.compile_ok === true && e.sorry_free === true;

export const IndexRow = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["problem", "library"]),
  collection: z.string(),
  submitted: z.boolean(),
  n_misformalizations: z.number(),
  n_questionable: z.number(),
  n_minor: z.number(),
  n_status_issues: z.number(),
  n_reformulations: z.number(),
  max_confidence: z.number().nullable(),
  kinds: z.array(z.string()),
  declarations: z.array(z.string()),
  headline: z.string().nullable(),
  trivial_proof: TrivialProofRow.default(NO_TRIVIAL_PROOF),
  fix: FixRow,
  lean_lines: z.number(),
  cost_usd: z.number(),
  minutes: z.number(),
  search: z.string(),
});
export type IndexRow = z.infer<typeof IndexRow>;

export const CollectionMeta = z.object({
  n_files: z.number(),
  n_flagged: z.number(),
  n_misformalizations: z.number(),
  n_fixed: z.number(),
  n_trivial_proof: z.number().default(0),
  n_status_issues: z.number(),
});
export type CollectionMeta = z.infer<typeof CollectionMeta>;

export const Meta = z.object({
  run_id: z.string(),
  log_name: z.string(),
  viewer_url: z.string().nullable(),
  transcript_base: z.string().nullable(),
  task: z.string().nullable(),
  model: z.string().nullable(),
  reasoning_effort: z.string().nullable(),
  task_args: z.record(z.string(), z.unknown()),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  fc_commit: z.string(),
  fc_repo_url: z.string(),
  fc_tree_url: z.string(),
  fc_commit_date: z.string().nullable().default(null), // committer date of the reviewed commit; null before it was recorded
  cost_usd: z.number(),
  totals: z.record(z.string(), z.number()),
  trivial_proof: z.record(z.string(), z.number()).default({}),
  fix: z.record(z.string(), z.number()),
  collections: z.record(z.string(), CollectionMeta),
  // the example sets shipped into the sandbox, as the reviewer saw them; null in data exported before they were recorded
  n_past_examples: z.number().nullable().default(null),
  n_counter_examples: z.number().nullable().default(null),
  // one human-written sentence about the run's scope (a pull-request review, say), shown on the list and About pages
  note: z.object({ text: z.string(), url: z.string().nullable().default(null) }).nullable().default(null),
  // a later check of the flagged files against the repository: <sha>/upstream.jsonl lists the files whose
  // misformalizations were already reported or fixed upstream (one line per file); null when not done
  upstream: z.object({ file: z.string(), n_files: z.number(), n_findings: z.number(), checked_at: z.string() }).nullable().default(null),
  generated_at: z.string(),
});
export type Meta = z.infer<typeof Meta>;

export const IndexFile = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  meta: Meta,
  files: z.array(IndexRow),
});
export type IndexFile = z.infer<typeof IndexFile>;

export const FixSubmission = z.object({
  fixed: z.array(z.string()),
  not_fixed: z.array(z.object({ declaration: z.string(), reason: z.string() })),
  summary: z.string().default(""),
  compiles: z.boolean(),
  gave_up: z.boolean().default(false),
  gave_up_reason: z.string().default(""),
});
export type FixSubmission = z.infer<typeof FixSubmission>;

export const CompileError = z.object({
  severity: z.string().optional(),
  line: z.number().nullable().optional(),
  col: z.number().nullable().optional(),
  text: z.string(),
});

export const TrivialProofSubmission = z.object({
  demonstrated: z.array(z.object({ declaration: z.string(), kind: z.string(), claim: z.string().default("") })),
  not_demonstrated: z.array(z.object({ declaration: z.string(), reason: z.string() })).default([]),
  summary: z.string().default(""),
  compiles: z.boolean().default(true),
  gave_up: z.boolean().default(false),
  gave_up_reason: z.string().default(""),
});
export type TrivialProofSubmission = z.infer<typeof TrivialProofSubmission>;

export const FileTrivialProof = TrivialProofRow.extend({
  compile_errors: z.array(CompileError).default([]),
  limit_hit: z.string().nullable().default(null),
  submission: TrivialProofSubmission.nullable().default(null),
  checkout_modified: z.array(z.string()).default([]),
  lean: z.string().nullable().default(null),
});
export type FileTrivialProof = z.infer<typeof FileTrivialProof>;
export const NO_FILE_TRIVIAL_PROOF: FileTrivialProof = { ...NO_TRIVIAL_PROOF, compile_errors: [], limit_hit: null, submission: null, checkout_modified: [], lean: null };

export const FileFix = FixRow.extend({
  compile_clean: z.boolean().nullable(),
  compile_errors: z.array(CompileError),
  reverted: z.boolean(),
  limit_hit: z.string().nullable(),
  submission: FixSubmission.nullable(),
  checkout_modified: z.array(z.string()),
  after: z.string().nullable(),
});
export type FileFix = z.infer<typeof FileFix>;

export const FileEntry = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["problem", "library"]),
  collection: z.string(),
  module: z.string().nullable(),
  fc_commit: z.string(),
  urls: z.object({ github: z.string(), raw: z.string() }),
  lean: z.string(),
  review: z.object({
    submitted: z.boolean(),
    findings: z.array(Finding),
    status_issues: z.array(StatusIssue),
    reformulations: z.array(Reformulation),
    sources_consulted: z.array(z.string()),
    could_not_verify: z.array(z.string()),
    notes: z.string(),
  }),
  trivial_proof: FileTrivialProof.default(NO_FILE_TRIVIAL_PROOF),
  fix: FileFix,
  sample: z.object({
    uuid: z.string().nullable(),
    transcript_url: z.string().nullable(),
    cost_usd: z.number(),
    working_minutes: z.number(),
    total_minutes: z.number(),
    attempts_used: z.number().nullable(),
    limit_hit: z.string().nullable(),
    examples_shown: z.number().nullable(),
    checkout_modified: z.array(z.string()),
  }),
});
export type FileEntry = z.infer<typeof FileEntry>;

export const KIND_LABELS: Record<string, string> = {
  wrong_statement: "wrong statement",
  wrong_definition: "wrong definition",
  vacuous_or_trivial: "vacuous or trivial",
  docstring_mismatch: "docstring mismatch",
  other: "other",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

// What a run covered: a named selection of files (task args files/collections; the log records unset
// args as null) rather than the whole tree, and whether the FormalConjecturesForMathlib/ files were in it.
export function runScope(meta: Meta): { subset: boolean; library: boolean } {
  return { subset: Boolean(meta.task_args.files) || Boolean(meta.task_args.collections), library: "ForMathlib" in meta.collections };
}

// <site>/runs.json, written at build from the data tree (scripts/runs.ts): where a run stands among the runs.
// `latest` is the latest run over the whole tree; runs over a selection of files never are.
export const RunsFile = z.object({
  latest: z.string(),
  runs: z.array(
    z.object({ sha: z.string(), fc_commit: z.string(), fc_commit_date: z.string().nullable(), started_at: z.string(), files: z.number(), subset: z.boolean() }),
  ),
});
export type RunsFile = z.infer<typeof RunsFile>;

// One line of <sha>/upstream.jsonl: a flagged file whose misformalizations were already reported or
// fixed upstream when checked, with the pull requests and issues judged to address the same defects.
export const UpstreamRecord = z.object({
  file: z.string(),
  path: z.string(),
  fc_commit: z.string(),
  findings: z.array(z.object({ declaration: z.string(), kind: z.string() })),
  covered_by: z.array(
    z.object({
      type: z.enum(["pr", "issue"]),
      number: z.number(),
      url: z.string(),
      title: z.string(),
      state: z.enum(["merged", "open"]),
      merged_at: z.string().nullable().default(null),
      note: z.string().default(""),
    }),
  ),
  checked_at: z.string(),
});
export type UpstreamRecord = z.infer<typeof UpstreamRecord>;

// One line of <sha>/issues.jsonl: an issue this project filed on formal-conjectures for a flagged file
// (scripts/file-issues.ts writes it). The file is optional; the site treats its absence as "none filed".
export const IssueRecord = z.object({
  file: z.string(),
  path: z.string(),
  fc_commit: z.string(),
  number: z.number(),
  url: z.string(),
  title: z.string(),
  created_at: z.string(),
  comment_url: z.string().nullable().default(null),
});
export type IssueRecord = z.infer<typeof IssueRecord>;
