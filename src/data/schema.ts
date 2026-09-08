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
  n_status_issues: z.number(),
});
export type CollectionMeta = z.infer<typeof CollectionMeta>;

export const Meta = z.object({
  run_id: z.string(),
  log_name: z.string(),
  viewer_url: z.string().nullable(),
  task: z.string().nullable(),
  model: z.string().nullable(),
  reasoning_effort: z.string().nullable(),
  task_args: z.record(z.string(), z.unknown()),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  fc_commit: z.string(),
  fc_repo_url: z.string(),
  fc_tree_url: z.string(),
  cost_usd: z.number(),
  totals: z.record(z.string(), z.number()),
  fix: z.record(z.string(), z.number()),
  collections: z.record(z.string(), CollectionMeta),
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
  fix: FileFix,
  sample: z.object({
    uuid: z.string().nullable(),
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
