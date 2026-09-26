"use client";

import { useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "@/domain/graph/types";
import { computeGraphLayout3d } from "@/lib/graph/layout";
import { GRAPH_ACCENT_HEX, GRAPH_KIND_COLOR } from "@/lib/graph/visual";
import styles from "./GraphCanvas2D.module.css";

export type GraphCanvas2DProps = {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const VIEW = 120;

export function GraphCanvas2D({ nodes, edges, selectedId, onSelect }: GraphCanvas2DProps) {
  const layout = useMemo(() => computeGraphLayout3d(nodes, edges), [nodes, edges]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    setPan({
      x: drag.current.px + (event.clientX - drag.current.x) / zoom,
      y: drag.current.py + (event.clientY - drag.current.y) / zoom,
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const next = Math.min(2.2, Math.max(0.55, zoom - event.deltaY * 0.0012));
    setZoom(next);
  };

  return (
    <div
      className={styles.wrap}
      data-graph-hits="2d"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      role="application"
      aria-label="지식 지도 2D"
    >
      <div className={styles.hud}>
        <span>줌 · {Math.round(zoom * 100)}%</span>
        <span>노드 {nodes.length}</span>
      </div>
      <svg
        className={styles.svg}
        viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {edges.map((edge) => {
            const from = layout.points.get(edge.from);
            const to = layout.points.get(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x * 4}
                y1={-from.y * 4}
                x2={to.x * 4}
                y2={-to.y * 4}
                className={styles.edge}
              />
            );
          })}
          {nodes.map((node) => {
            const point = layout.points.get(node.id);
            if (!point) return null;
            const selected = node.id === selectedId;
            const r = selected ? 5.2 : 4.2;
            const cx = point.x * 4;
            const cy = -point.y * 4;
            return (
              <g key={node.id}>
                {selected ? (
                  <circle cx={cx} cy={cy} r={r + 2.2} fill={GRAPH_ACCENT_HEX} opacity={0.22} />
                ) : null}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={GRAPH_KIND_COLOR[node.kind]}
                  className={styles.node}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node.id);
                  }}
                />
                <text x={cx} y={cy + r + 4} className={styles.label} textAnchor="middle">
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
