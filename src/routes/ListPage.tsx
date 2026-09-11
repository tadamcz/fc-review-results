import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { KindChip, RowChips } from "../components/Chips";
import { TopBar } from "../components/TopBar";
import { ConfidenceContext, effectiveState, showConfidence } from "../data/confidence";
import { CONF_STEPS, DEFAULT_STATE, SHOW_LABELS, applyFilters, hasFilters, misfFiltersApply, parseState, serializeState, type ListState, type Show, type Sort } from "../data/filters";
import { useIndex } from "../data/load";
import { kindLabel, type IndexRow, type Meta } from "../data/schema";

const KINDS = ["wrong_statement", "wrong_definition", "vacuous_or_trivial"];

export function ListPage() {
  const index = useIndex();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseState(params), [params]);
  const searchRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    (patch: Partial<ListState>) => {
      setParams((prev) => serializeState({ ...parseState(prev), ...patch }), { replace: true });
    },
    [setParams],
  );

  // the search box keeps its own immediate value; the URL follows with a short delay
  const [q, setQ] = useState(state.q);
  const pushed = useRef(state.q);
  const debounce = useRef<number | null>(null);
  useEffect(() => {
    if (state.q !== pushed.current) {
      pushed.current = state.q;
      setQ(state.q);
    }
  }, [state.q]);
  useEffect(() => () => window.clearTimeout(debounce.current ?? undefined), []);
  const onSearch = (value: string) => {
    setQ(value);
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      pushed.current = value;
      update({ q: value });
    }, 150);
  };
  const deferredQ = useDeferredValue(q);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.title = "Formal Conjectures audit";
  }, []);

  if (index.status === "loading") return <Shell><p className="muted">Loading…</p></Shell>;
  if (index.status === "error") return <Shell><p className="error">Could not load the index: {index.error}</p></Shell>;
  const { meta, files } = index.data;
  const showConf = showConfidence(meta);
  const visible = applyFilters(files, effectiveState({ ...state, q: deferredQ }, showConf));
  const search = params.toString();
  const t = meta.totals;

  return (
    <Shell>
      <ConfidenceContext.Provider value={showConf}>
      <p className="count-line">
        {t.files} files of formal-conjectures at{" "}
        <a href={meta.fc_tree_url} target="_blank" rel="noopener noreferrer">
          <code>{meta.fc_commit.slice(0, 10)}</code>
        </a>{" "}
        reviewed · {t.misformalizations} misformalizations reported in {t.flagged} files ·{" "}
        {meta.evidence.attempted ? <>{meta.evidence.compiles ?? 0} with compiling Lean evidence · </> : null}
        {meta.fix.compiles ?? 0} with a compiling fix · {t.status_issues} status issues · <Link to="/about">about this audit</Link>
      </p>
      <div className="list-layout">
        <aside className="list-side">
          <CollectionSidebar meta={meta} selected={state.collection} onSelect={(c) => update({ collection: c })} />
        </aside>
        <div className="list-main">
          <div className="toolbar">
            <CollectionSelect meta={meta} selected={state.collection} onSelect={(c) => update({ collection: c })} />
            <input
              ref={searchRef}
              type="search"
              className="search"
              placeholder="Search file ids, declarations, findings…  ( / )"
              value={q}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="Search"
            />
            <label className="sort">
              Sort
              <select value={effectiveState(state, showConf).sort} onChange={(e) => update({ sort: e.target.value as Sort })}>
                <option value="misf">most misformalizations</option>
                {showConf && <option value="confidence">highest confidence</option>}
                <option value="id">file id A–Z</option>
              </select>
            </label>
            <span className="result-count muted">{visible.length === files.length ? `${files.length} files` : `${visible.length} of ${files.length} files`}</span>
          </div>
          <Filters state={state} onChange={update} showConf={showConf} />
          {visible.length === 0 && <p className="muted empty">No files match.</p>}
          <ol className="rows">
            {visible.map((r) => (
              <Row key={r.id} row={r} search={search} showCollection={!state.collection} showConf={showConf} />
            ))}
          </ol>
        </div>
      </div>
      </ConfidenceContext.Provider>
    </Shell>
  );
}

function Filters({ state, onChange, showConf }: { state: ListState; onChange: (patch: Partial<ListState>) => void; showConf: boolean }) {
  const misf = misfFiltersApply(state.show);
  const inert = misf ? undefined : "Applies to misformalizations; not to this view";
  return (
    <div className="filters" role="group" aria-label="Filters">
      <label className="filter">
        Show
        <select value={state.show} onChange={(e) => onChange({ show: e.target.value as Show })}>
          {(Object.keys(SHOW_LABELS) as Show[]).map((s) => (
            <option key={s} value={s}>
              {SHOW_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className={`filter${misf ? "" : " inert"}`} title={inert}>
        Misformalization kind
        <select value={state.kind ?? ""} disabled={!misf} onChange={(e) => onChange({ kind: e.target.value || null })}>
          <option value="">any</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(k)}
            </option>
          ))}
        </select>
      </label>
      {showConf && (
      <label className={`filter${misf ? "" : " inert"}`} title={inert}>
        Highest confidence ≥
        <select value={state.confMin === null ? "" : String(state.confMin)} disabled={!misf} onChange={(e) => onChange({ confMin: e.target.value === "" ? null : Number(e.target.value) })}>
          <option value="">any</option>
          {CONF_STEPS.map((v) => (
            <option key={v} value={String(v)}>
              {v.toFixed(2)}
            </option>
          ))}
        </select>
      </label>
      )}
      {hasFilters(effectiveState(state, showConf)) && (
        <button className="clear" onClick={() => onChange({ show: DEFAULT_STATE.show, kind: null, confMin: null })}>
          Clear
        </button>
      )}
    </div>
  );
}

export function orderedCollections(meta: Meta): Array<[string, Meta["collections"][string]]> {
  return Object.entries(meta.collections).sort((a, b) => b[1].n_files - a[1].n_files || a[0].localeCompare(b[0]));
}

function CollectionSidebar({ meta, selected, onSelect }: { meta: Meta; selected: string | null; onSelect: (c: string | null) => void }) {
  const t = meta.totals;
  return (
    <ul className="area-list">
      <li>
        <button className={selected === null ? "active" : ""} onClick={() => onSelect(null)}>
          <span>All collections</span>
          <span className="count">
            {t.flagged} / {t.files}
          </span>
        </button>
      </li>
      {orderedCollections(meta).map(([name, c]) => (
        <li key={name}>
          <button className={selected === name ? "active" : ""} onClick={() => onSelect(name)} title={`${c.n_flagged} of ${c.n_files} files flagged`}>
            <span>{name}</span>
            <span className="count">
              {c.n_flagged} / {c.n_files}
            </span>
          </button>
        </li>
      ))}
      <li className="legend muted small">flagged / files</li>
    </ul>
  );
}

function CollectionSelect({ meta, selected, onSelect }: { meta: Meta; selected: string | null; onSelect: (c: string | null) => void }) {
  return (
    <select className="area-select" value={selected ?? ""} onChange={(e) => onSelect(e.target.value || null)} aria-label="Collection">
      <option value="">All collections</option>
      {orderedCollections(meta).map(([name, c]) => (
        <option key={name} value={name}>
          {name} ({c.n_flagged}/{c.n_files})
        </option>
      ))}
    </select>
  );
}

const Row = memo(function Row({ row, search, showCollection, showConf }: { row: IndexRow; search: string; showCollection: boolean; showConf: boolean }) {
  const navigate = useNavigate();
  return (
    <li
      className="row"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        navigate({ pathname: `/f/${row.id}`, search });
      }}
    >
      <div className="row-line1">
        <Link to={{ pathname: `/f/${row.id}`, search }} className="row-title">
          {row.id}
        </Link>
        <RowChips row={row} />
      </div>
      <div className="row-line2">
        <span className="row-statement">
          {showCollection && <span className="row-area">{row.collection}{row.headline ? " · " : ""}</span>}
          {row.headline && <span className="headline">{row.headline}</span>}
          {!row.headline && row.n_status_issues > 0 && <span className="muted">status issue only</span>}
        </span>
        <span className="counts">
          {showConf && row.max_confidence !== null && <span title="highest confidence among the misformalizations">p ≤ {row.max_confidence.toFixed(2)}</span>}
          {row.kinds.map((k) => (
            <KindChip key={k} kind={k} />
          ))}
        </span>
      </div>
    </li>
  );
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="page">{children}</main>
    </>
  );
}
