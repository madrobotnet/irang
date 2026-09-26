import type { GraphDepth, GraphNode, GraphNodeKind, GraphQuery, GraphRelation } from "@/domain/graph/types";
import { GRAPH_DEPTHS, GRAPH_NODE_KINDS, GRAPH_RELATIONS } from "@/domain/graph/types";
import { GRAPH_COPY, GRAPH_KIND_CHIP, GRAPH_RELATION_CHIP } from "@/lib/graph/copy";
import styles from "./GraphFilters.module.css";

type GraphFiltersProps = {
  query: GraphQuery;
  seedLabel: string;
  nodes: readonly GraphNode[];
  seedOpen: boolean;
  onToggleSeedOpen: () => void;
  onSeed: (seedId: string | null) => void;
  onDepth: (depth: GraphDepth) => void;
  onKind: (kind: GraphNodeKind) => void;
  onRelation: (relation: GraphRelation) => void;
  onAll: () => void;
};

export function GraphFilters({
  query,
  seedLabel,
  nodes,
  seedOpen,
  onToggleSeedOpen,
  onSeed,
  onDepth,
  onKind,
  onRelation,
  onAll,
}: GraphFiltersProps) {
  const allMode = query.mode === "full";
  const kindsAll = query.kinds.length === GRAPH_NODE_KINDS.length;
  const relsAll = query.relations.length === GRAPH_RELATIONS.length;
  return (
    <div className={styles.filters} data-graph-filters="true">
      <div className={styles.seedWrap}>
        <button
          type="button"
          className={allMode ? styles.chip : styles.chipOn}
          aria-expanded={seedOpen}
          onClick={onToggleSeedOpen}
        >
          {GRAPH_COPY.seed} · {allMode ? GRAPH_COPY.all : seedLabel}
        </button>
        {seedOpen ? (
          <ul className={styles.picker} role="listbox">
            {nodes.map((node) => (
              <li key={node.id}>
                <button type="button" onClick={() => onSeed(node.id)}>
                  {node.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className={styles.depths} role="group" aria-label={GRAPH_COPY.depth}>
        {GRAPH_DEPTHS.map((depth) => (
          <button
            key={depth}
            type="button"
            className={query.depth === depth && !allMode ? styles.chipOn : styles.chip}
            aria-pressed={query.depth === depth && !allMode}
            onClick={() => onDepth(depth)}
          >
            {depth}
          </button>
        ))}
      </div>
      <div className={styles.kinds} role="group" aria-label={GRAPH_COPY.type}>
        <span className={styles.groupLabel}>
          {GRAPH_COPY.type} · {kindsAll ? GRAPH_NODE_KINDS.length : query.kinds.length}
        </span>
        {GRAPH_NODE_KINDS.map((kind) => {
          const on = query.kinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              className={on ? styles.chipOn : styles.chip}
              aria-pressed={on}
              onClick={() => onKind(kind)}
            >
              {GRAPH_KIND_CHIP[kind]}
            </button>
          );
        })}
      </div>
      <div className={styles.rels} role="group" aria-label={GRAPH_COPY.relation}>
        <span className={styles.groupLabel}>
          {GRAPH_COPY.relation} · {relsAll ? GRAPH_COPY.all : query.relations.length}
        </span>
        {GRAPH_RELATIONS.map((relation) => {
          const on = query.relations.includes(relation);
          return (
            <button
              key={relation}
              type="button"
              className={on ? styles.chipOn : styles.chip}
              aria-pressed={on}
              onClick={() => onRelation(relation)}
            >
              {GRAPH_RELATION_CHIP[relation]}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={allMode ? styles.chipOn : styles.chip}
        aria-pressed={allMode}
        onClick={onAll}
      >
        {GRAPH_COPY.all}
      </button>
    </div>
  );
}
