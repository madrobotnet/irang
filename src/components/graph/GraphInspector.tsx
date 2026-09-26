import Link from "next/link";
import type { GraphEdge, GraphNode } from "@/domain/graph/types";
import { GRAPH_COPY, GRAPH_KIND_BADGE, GRAPH_RELATION_CHIP } from "@/lib/graph/copy";
import { graphChatHref, graphNotePath } from "@/lib/graph/query";
import { nodeDegree } from "@/lib/graph/layout";
import styles from "./GraphInspector.module.css";

type GraphInspectorProps = {
  node: GraphNode;
  edges: readonly GraphEdge[];
  nodes: readonly GraphNode[];
  expanded: boolean;
  onToggleExpand: () => void;
};

function neighborLabel(
  edge: GraphEdge,
  nodeId: string,
  nodes: readonly GraphNode[],
): string {
  const otherId = edge.from === nodeId ? edge.to : edge.from;
  return nodes.find((item) => item.id === otherId)?.label ?? otherId;
}

function relativeUpdated(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) {
    return iso;
  }
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) {
    return "방금";
  }
  if (minutes < 60) {
    return `${minutes}분 전`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}시간 전`;
  }
  return `${Math.round(hours / 24)}일 전`;
}

export function GraphInspector({
  node,
  edges,
  nodes,
  expanded,
  onToggleExpand,
}: GraphInspectorProps) {
  const connected = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const peek = connected.slice(0, 5);
  const extra = connected.length - peek.length;
  const degree = nodeDegree(node.id, edges);

  return (
    <aside
      className={styles.inspector}
      data-graph-inspector="true"
      data-expanded={expanded ? "true" : "false"}
    >
      <button type="button" className={styles.handle} onClick={onToggleExpand} aria-expanded={expanded}>
        <span className={styles.handleBar} aria-hidden="true" />
      </button>
      <div className={styles.body}>
        <p className={styles.kind}>{GRAPH_KIND_BADGE[node.kind]}</p>
        <h2 className={styles.title}>{node.label}</h2>
        <p className={styles.meta}>
          {relativeUpdated(node.updatedAt)} · 연결 {degree}
        </p>
        <section className={styles.edges} aria-label={GRAPH_COPY.connected}>
          <p className={styles.edgeHeading}>{GRAPH_COPY.connected}</p>
          {peek.length === 0 ? (
            <p className={styles.isolate}>고립 노드</p>
          ) : (
            <ul className={styles.edgeList}>
              {peek.map((edge) => (
                <li key={edge.id}>
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.edgeLabel}>{neighborLabel(edge, node.id, nodes)}</span>
                  <span className={styles.rel}>{GRAPH_RELATION_CHIP[edge.relation]}</span>
                </li>
              ))}
            </ul>
          )}
          {extra > 0 ? <p className={styles.more}>+{extra} more</p> : null}
        </section>
        <div className={styles.actions}>
          <Link className={styles.ghost} href={graphNotePath(node.id)}>
            {GRAPH_COPY.openNote}
          </Link>
          <Link className={styles.primary} href={graphChatHref(node.id)}>
            {GRAPH_COPY.chatNode}
          </Link>
        </div>
      </div>
    </aside>
  );
}
