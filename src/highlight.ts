// Client-side Lean highlighting: Shiki's JavaScript regex engine with the lean4
// grammar and the github-light theme, loaded once on first use. The data files
// stay exactly what the exporter wrote; nothing is pre-rendered. Code.tsx
// renders the tokens itself so that URLs inside comments can become links.
import { useEffect, useState } from "react";
import type { HighlighterCore, ThemedToken } from "shiki/core";

let highlighter: HighlighterCore | null = null;
let loading: Promise<HighlighterCore> | null = null;
const cache = new Map<string, ThemedToken[][]>();

export function loadHighlighter(): Promise<HighlighterCore> {
  if (highlighter) return Promise.resolve(highlighter);
  if (!loading) {
    loading = Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("shiki/langs/lean4.mjs"),
      import("shiki/themes/github-light.mjs"),
    ]).then(async ([core, engine, lean4, theme]) => {
      highlighter = await core.createHighlighterCore({
        themes: [theme.default],
        langs: [lean4.default],
        engine: engine.createJavaScriptRegexEngine({ forgiving: true }),
      });
      return highlighter;
    });
  }
  return loading;
}

/** One token list per line, or null until the highlighter has loaded. */
export function tokenizeLean(code: string): ThemedToken[][] | null {
  if (!highlighter) return null;
  const hit = cache.get(code);
  if (hit !== undefined) return hit;
  const { tokens } = highlighter.codeToTokens(code, { lang: "lean4", theme: "github-light" });
  cache.set(code, tokens);
  return tokens;
}

export function useHighlighter(): boolean {
  const [ready, setReady] = useState(highlighter !== null);
  useEffect(() => {
    if (ready) return;
    let live = true;
    loadHighlighter().then(() => live && setReady(true), () => undefined);
    return () => {
      live = false;
    };
  }, [ready]);
  return ready;
}
