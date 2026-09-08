// Fetch + cache of the exporter's JSON. data/ is Vite's public directory, so
// the committed files are served as-is at the site root.
import { useEffect, useState } from "react";
import type { FileEntry, IndexFile } from "./schema";

const cache = new Map<string, Promise<unknown>>();

function url(rel: string): string {
  return `${import.meta.env.BASE_URL}${rel}`;
}

function fetchJson<T>(rel: string): Promise<T> {
  let p = cache.get(rel);
  if (!p) {
    p = fetch(url(rel)).then((r) => {
      if (!r.ok) throw new Error(`${rel}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(rel));
    cache.set(rel, p);
  }
  return p as Promise<T>;
}

export const loadIndex = () => fetchJson<IndexFile>("index.json");
// ids carry slashes (ErdosProblems/1): each segment is encoded, the slashes stay
export const loadFile = (id: string) =>
  fetchJson<FileEntry>(`files/${id.split("/").map(encodeURIComponent).join("/")}.json`);

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

export function useFile(id: string | undefined): Loaded<FileEntry> {
  return useLoaded(id ? () => loadFile(id) : null, `file:${id}`);
}
