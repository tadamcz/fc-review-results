// Whether to show the reviewer's per-finding confidence. GPT-6 Astra reports
// p = 1.0 for nearly everything, so for Astra runs the numbers carry no
// information and are hidden everywhere (finding cards, list rows, the
// confidence filter and sort). Any other model shows them.
import { createContext, useContext } from "react";
import type { ListState } from "./filters";
import type { Meta } from "./schema";

export function showConfidence(meta: Meta | null | undefined): boolean {
  return !/astra/i.test(meta?.model ?? "");
}

export const ConfidenceContext = createContext<boolean>(true);

export function useShowConfidence(): boolean {
  return useContext(ConfidenceContext);
}

// With confidence hidden, a confidence filter or sort left in the URL must not act.
export function effectiveState(state: ListState, show: boolean): ListState {
  if (show) return state;
  return { ...state, confMin: null, sort: state.sort === "confidence" ? "misf" : state.sort };
}
