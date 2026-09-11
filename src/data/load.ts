// Fetch + cache of the exporter's JSON. The app is served at <site>/<fc sha>/
// beside that run's index.json and files/** (see scripts/runs.ts), so the paths
// are relative to the document. The JSON goes through the zod schemas, as in
// scripts/check.ts: the defaults there are what lets a run exported before a
// field existed (e.g. `trivial_proof`) render.
import { useEffect, useState } from "react";
import type { z } from "zod";
import { FileEntry, IndexFile, RunsFile } from "./schema";

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

export function useFile(id: string | undefined): Loaded<FileEntry> {
  return useLoaded(id ? () => loadFile(id) : null, `file:${id}`);
}
