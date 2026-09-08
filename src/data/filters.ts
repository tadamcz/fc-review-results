// URL query <-> list state, search, sort, and neighbours for ‹ › on the file page.
import type { IndexRow } from "./schema";

export type Show = "flagged" | "all" | "fixed" | "gave_up" | "status" | "clean" | "unsubmitted";
export type Sort = "misf" | "confidence" | "id" | "cost";

export interface ListState {
  q: string;
  collection: string | null;
  show: Show;
  kind: string | null;
  confMin: number | null;
  sort: Sort;
}

export const SHOW_LABELS: Record<Show, string> = {
  flagged: "with misformalizations",
  all: "all files",
  fixed: "with a compiling fix",
  gave_up: "fix bailed out",
  status: "with status issues",
  clean: "no misformalizations",
  unsubmitted: "no review submitted",
};

export const DEFAULT_STATE: ListState = { q: "", collection: null, show: "flagged", kind: null, confMin: null, sort: "misf" };

export const CONF_STEPS = [0.5, 0.7, 0.8, 0.9, 0.95, 0.99];

// `kinds` and `max_confidence` describe a file's misformalization-severity
// findings, so the Kind and Confidence filters only mean something when the
// shown set is about misformalizations; for the other views they are inert.
export function misfFiltersApply(show: Show): boolean {
  return show === "flagged" || show === "all" || show === "fixed" || show === "gave_up";
}

function num(v: string | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const SHOWS = Object.keys(SHOW_LABELS) as Show[];
const SORTS: Sort[] = ["misf", "confidence", "id", "cost"];

export function parseState(params: URLSearchParams): ListState {
  const show = params.get("show");
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    collection: params.get("c"),
    show: SHOWS.includes(show as Show) ? (show as Show) : DEFAULT_STATE.show,
    kind: params.get("kind"),
    confMin: num(params.get("cmin")),
    sort: SORTS.includes(sort as Sort) ? (sort as Sort) : DEFAULT_STATE.sort,
  };
}

export function serializeState(state: ListState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.collection) p.set("c", state.collection);
  if (state.show !== DEFAULT_STATE.show) p.set("show", state.show);
  if (state.kind) p.set("kind", state.kind);
  if (state.confMin !== null) p.set("cmin", String(state.confMin));
  if (state.sort !== DEFAULT_STATE.sort) p.set("sort", state.sort);
  return p;
}

export function hasFilters(state: ListState): boolean {
  return state.show !== DEFAULT_STATE.show || (misfFiltersApply(state.show) && (state.kind !== null || state.confMin !== null));
}

function matchesShow(r: IndexRow, show: Show): boolean {
  switch (show) {
    case "all":
      return true;
    case "flagged":
      return r.n_misformalizations > 0;
    case "fixed":
      return r.fix.changed && r.fix.compile_ok === true;
    case "gave_up":
      return r.fix.gave_up;
    case "status":
      return r.n_status_issues > 0;
    case "clean":
      return r.submitted && r.n_misformalizations === 0;
    case "unsubmitted":
      return !r.submitted;
  }
}

export function applyFilters(rows: IndexRow[], state: ListState): IndexRow[] {
  const q = state.q.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  const misf = misfFiltersApply(state.show);
  const out = rows.filter((r) => {
    if (state.collection && r.collection !== state.collection) return false;
    if (!matchesShow(r, state.show)) return false;
    if (misf && state.kind && !r.kinds.includes(state.kind)) return false;
    if (misf && state.confMin !== null && (r.max_confidence === null || r.max_confidence < state.confMin)) return false;
    if (terms.length && !terms.every((t) => r.search.includes(t))) return false;
    return true;
  });
  const byId = (a: IndexRow, b: IndexRow) => a.id.localeCompare(b.id, undefined, { numeric: true });
  switch (state.sort) {
    case "misf":
      out.sort((a, b) => b.n_misformalizations - a.n_misformalizations || (b.max_confidence ?? 0) - (a.max_confidence ?? 0) || byId(a, b));
      break;
    case "confidence":
      out.sort((a, b) => (b.max_confidence ?? -1) - (a.max_confidence ?? -1) || byId(a, b));
      break;
    case "cost":
      out.sort((a, b) => b.cost_usd - a.cost_usd || byId(a, b));
      break;
    case "id":
      out.sort(byId);
      break;
  }
  return out;
}

export function neighbours(ids: string[], id: string): { prev: string | null; next: string | null } {
  const i = ids.indexOf(id);
  if (i === -1) return { prev: null, next: null };
  return { prev: i > 0 ? ids[i - 1] : null, next: i + 1 < ids.length ? ids[i + 1] : null };
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function money(n: number): string {
  return n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`;
}
