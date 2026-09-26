import Link from "next/link";
import type { ReactNode } from "react";
import type { GraphDepth, GraphNodeKind, GraphRelation } from "@/domain/graph/types";
import { GRAPH_COPY } from "@/lib/graph/copy";
import type { GraphViewModel } from "@/lib/graph/view-model";
import { graphSurface, selectedNode, showOverloadBanner } from "@/lib/graph/view-model";
import { GraphEmpty } from "./GraphEmpty";
import { GraphError } from "./GraphError";
import { GraphFilters } from "./GraphFilters";
import { GraphInspector } from "./GraphInspector";
import { GraphOverloadBanner } from "./GraphOverloadBanner";
import styles from "./GraphView.module.css";

export type GraphViewProps = {
  model: GraphViewModel;
  seedOpen: boolean;
  inspectorExpanded: boolean;
  canvas: ReactNode;
  onCapture: () => void;
  onRetry: () => void;
  onDismissBanner: () => void;
  onToggleSeedOpen: () => void;
  onSeed: (seedId: string | null) => void;
  onDepth: (depth: GraphDepth) => void;
  onKind: (kind: GraphNodeKind) => void;
  onRelation: (relation: GraphRelation) => void;
  onAll: () => void;
  onToggleInspector: () => void;
};

export function GraphView({
  model,
  seedOpen,
  inspectorExpanded,
  canvas,
  onCapture,
  onRetry,
  onDismissBanner,
  onToggleSeedOpen,
  onSeed,
  onDepth,
  onKind,
  onRelation,
  onAll,
  onToggleInspector,
}: GraphViewProps) {
  const surface = graphSurface(model);
  const selected = selectedNode(model);
  const nodes = model.payload?.nodes ?? [];
  const edges = model.payload?.edges ?? [];
  const seed = nodes.find((node) => node.id === model.payload?.seedId) ?? nodes[0];
  const seedLabel = seed?.label ?? "—";
  const nodeCount = nodes.length;
  const showInspector = selected !== null && surface === "graph";
  const meta =
    surface === "empty"
      ? "빈 vault"
      : surface === "graph"
        ? `seed · depth ${model.query.depth} · ${nodeCount} nodes`
        : surface === "error"
          ? GRAPH_COPY.error
          : "…";

  return (
    <div className={styles.view} data-graph-view={surface} data-inspector={showInspector ? "on" : "off"}>
      <header className={styles.top}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>지식 지도 · 2D</p>
          <h1 className={styles.title}>{GRAPH_COPY.title}</h1>
          <p className={styles.meta}>{meta}</p>
        </div>
        <div className={styles.topActions}>
          <Link href="/search" className={styles.mapSearch}>
            지도에서 찾기
          </Link>
          <button type="button" className={styles.capture} onClick={onCapture}>
            {GRAPH_COPY.capture}
          </button>
        </div>
      </header>
      <GraphFilters
        query={model.query}
        seedLabel={seedLabel}
        nodes={nodes}
        seedOpen={seedOpen}
        onToggleSeedOpen={onToggleSeedOpen}
        onSeed={onSeed}
        onDepth={onDepth}
        onKind={onKind}
        onRelation={onRelation}
        onAll={onAll}
      />
      {showOverloadBanner(model) ? <GraphOverloadBanner onDismiss={onDismissBanner} /> : null}
      <div className={styles.stage}>
        <div className={styles.canvas}>
          {surface === "loading" ? <div className={styles.loading} aria-busy="true" /> : null}
          {surface === "error" ? <GraphError onRetry={onRetry} /> : null}
          {surface === "empty" ? <GraphEmpty onCapture={onCapture} /> : null}
          {surface === "graph" ? canvas : null}
          {surface === "graph" ? (
            <p className={styles.hint}>
              {GRAPH_COPY.orbitHint} · {nodeCount} nodes · {edges.length} edges
            </p>
          ) : null}
        </div>
        {showInspector && selected ? (
          <GraphInspector
            node={selected}
            edges={edges}
            nodes={nodes}
            expanded={inspectorExpanded}
            onToggleExpand={onToggleInspector}
          />
        ) : null}
      </div>
    </div>
  );
}
