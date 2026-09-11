// Fetch + cache of the exporter's JSON. The app is served at <site>/<fc sha>/
// beside that run's index.json and files/** (see scripts/runs.ts), so the paths
// are relative to the document. The JSON goes through the zod schemas, as in
// scripts/check.ts: the defaults there are what lets a run exported before a
// field existed (e.g. `trivial_proof`) render.
import { useEffect, useState } from "react";
import type { z } from "zod";
import { FileEntry, IndexFile, IssueRecord, RunsFile, UpstreamRecord, type Meta } from "./schema";

const cache = new Map<string, Promise<unknown>>();

function fetchJson<S extends z.ZodType>(rel: string, schema: S): Promise<z.output<S>> {
  let p = cache.get(rel);
  if (!p) {
    p = fetch(rel).then(async (r) => {
      if (!r.ok) throw new Error(`${rel}: HTTP ${r.status}`);
      return schema.parse(await r.json());
    });
    p.catch(() => cache.delete(rel));
    cache.set(rel, p);
  }
  return p as Promise<z.output<S>>;
}

export const loadIndex = () => fetchJson("index.json", IndexFile);
// ids carry slashes (ErdosProblems/1): each segment is encoded, the slashes stay
export const loadFile = (id: string) => fetchJson(`files/${id.split("/").map(encodeURIComponent).join("/")}.json`, FileEntry);
// the run list lives at the site root, one level up from this run's directory
export const loadRuns = () => fetchJson("../runs.json", RunsFile);

// <sha>/upstream.jsonl, one JSON line per file already reported or fixed upstream, keyed by file id
export function loadUpstream(file: string): Promise<Map<string, UpstreamRecord>> {
  let p = cache.get(`jsonl:${file}`) as Promise<Map<string, UpstreamRecord>> | undefined;
  if (!p) {
    p = fetch(file).then(async (r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      const recs = (await r.text()).split("\n").filter((l) => l.trim()).map((l) => UpstreamRecord.parse(JSON.parse(l)));
      return new Map(recs.map((rec) => [rec.file, rec]));
    });
    p.catch(() => cache.delete(`jsonl:${file}`));
    cache.set(`jsonl:${file}`, p);
  }
  return p;
}

// <sha>/issues.jsonl, the issues this project filed for the run, keyed by file id; a missing file (404)
// is the normal case for a run with none, so it resolves to an empty map rather than an error
export function loadIssues(): Promise<Map<string, IssueRecord>> {
  let p = cache.get("jsonl:issues.jsonl") as Promise<Map<string, IssueRecord>> | undefined;
  if (!p) {
    p = fetch("issues.jsonl").then(async (r) => {
      if (r.status === 404) return new Map<string, IssueRecord>();
      if (!r.ok) throw new Error(`issues.jsonl: HTTP ${r.status}`);
      const text = await r.text();
      if (text.trimStart().startsWith("<")) return new Map<string, IssueRecord>(); // a host that answers 404 with an HTML page
      const recs = text.split("\n").filter((l) => l.trim()).map((l) => IssueRecord.parse(JSON.parse(l)));
      return new Map(recs.map((rec) => [rec.file, rec]));
    });
    p.catch(() => cache.delete("jsonl:issues.jsonl"));
    cache.set("jsonl:issues.jsonl", p);
  }
  return p;
}

export type Loaded<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ok"; data: T };

export function useLoaded<T>(loader: (() => Promise<T>) | null, key: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  useEffect(() => {
    if (!loader) return;
    let live = true;
    setState({ status: "loading" });
    loader().then(
      (data) => live && setState({ status: "ok", data }),
      (e: unknown) => live && setState({ status: "error", error: String(e) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useIndex(): Loaded<IndexFile> {
  return useLoaded(loadIndex, "index");
}

export function useRuns(): Loaded<RunsFile> {
  return useLoaded(loadRuns, "runs");
}

// The latest full run's sha when the run this page shows is not it — a pull-request review or an
// earlier audit — else null: what "switch to latest run" links to. Null while either file loads.
export function useSwitchToLatest(): string | null {
  const index = useIndex();
  const runs = useRuns();
  if (index.status !== "ok" || runs.status !== "ok") return null;
  return runs.data.latest !== index.data.meta.fc_commit.slice(0, 10) ? runs.data.latest : null;
}

// The run's upstream check, when it has one; an empty map for runs without (so callers need no special case).
export function useUpstream(upstream: Meta["upstream"] | null): Loaded<Map<string, UpstreamRecord>> {
  const loaded = useLoaded(upstream ? () => loadUpstream(upstream.file) : null, `upstream:${upstream?.file ?? ""}`);
  return upstream ? loaded : { status: "ok", data: new Map() };
}

export function useIssues(): Loaded<Map<string, IssueRecord>> {
  return useLoaded(loadIssues, "issues");
}

export function useFile(id: string | undefined): Loaded<FileEntry> {
  return useLoaded(id ? () => loadFile(id) : null, `file:${id}`);
}
