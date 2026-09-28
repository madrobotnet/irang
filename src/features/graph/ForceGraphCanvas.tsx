"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { GraphNode } from "@/lib/types";
import {
  cloneGraphData,
  endpointId,
  graphTooltip,
  neighborIds,
  primaryTag,
  stablePaletteIndex,
  type MutableGraphData,
  type MutableGraphLink,
  type MutableGraphNode,
} from "./graph-model";

export type GraphCanvasHandle = {
  fit(): void;
  reset(): void;
  zoomBy(factor: number): void;
  togglePin(nodeId: string): boolean;
};

type Props = {
  data: Parameters<typeof cloneGraphData>[0];
  height: number;
  selectedId: string | null;
  onSelect(node: GraphNode | null): void;
  onPinChange(nodeId: string, pinned: boolean): void;
};

const COLOR_VARS = ["--accent", "--ok", "--warn", "--danger"] as const;

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function themeSnapshot() {
  return document.documentElement.className;
}

function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function motionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useGraphColors() {
  useSyncExternalStore(subscribeTheme, themeSnapshot, () => "");
  const style = getComputedStyle(document.documentElement);
  return {
    ink: style.getPropertyValue("--ink").trim(),
    mute: style.getPropertyValue("--mute").trim(),
    line: style.getPropertyValue("--line-strong").trim(),
    card: style.getPropertyValue("--card").trim(),
    tags: COLOR_VARS.map((name) => style.getPropertyValue(name).trim()),
  };
}

export const ForceGraphCanvas = forwardRef<GraphCanvasHandle, Props>(function ForceGraphCanvas(
  { data, height, selectedId, onSelect, onPinChange },
  handleRef,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<MutableGraphNode, MutableGraphLink> | undefined>(undefined);
  const [width, setWidth] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, () => false);
  const graph = useMemo(() => cloneGraphData(data), [data]);
  const activeId = hoveredId ?? selectedId;
  const active = useMemo(() => neighborIds(graph, activeId), [graph, activeId]);
  const colors = useGraphColors();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, Math.floor(entry?.contentRect.width ?? 1))));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(handleRef, () => ({
    fit: () => graphRef.current?.zoomToFit(reducedMotion ? 0 : 300, 32),
    reset: () => {
      for (const node of graph.nodes) {
        node.fx = undefined;
        node.fy = undefined;
      }
      graphRef.current?.resumeAnimation();
      graphRef.current?.d3ReheatSimulation();
      graphRef.current?.zoomToFit(reducedMotion ? 0 : 300, 32);
    },
    zoomBy: (factor) => {
      const instance = graphRef.current;
      if (instance) instance.zoom(instance.zoom() * factor, reducedMotion ? 0 : 180);
    },
    togglePin: (nodeId) => {
      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return false;
      if (node.fx === undefined) {
        node.fx = node.x ?? 0;
        node.fy = node.y ?? 0;
        return true;
      }
      node.fx = undefined;
      node.fy = undefined;
      graphRef.current?.resumeAnimation();
      graphRef.current?.d3ReheatSimulation();
      return false;
    },
  }), [graph, reducedMotion]);

  const nodeColor = (node: MutableGraphNode) => {
    if (activeId && !active.has(node.id)) return colors.line;
    if (node.id === selectedId) return colors.ink;
    if (node.kind === "unresolved") return colors.mute;
    const tag = primaryTag(node);
    return tag ? colors.tags[stablePaletteIndex(tag, colors.tags.length)]! : colors.mute;
  };

  return (
    <div ref={hostRef} className="h-full w-full overflow-hidden rounded-card bg-card" style={{ height }}>
      <ForceGraph2D<MutableGraphNode, MutableGraphLink>
        ref={graphRef}
        graphData={graph as MutableGraphData}
        width={width}
        height={height}
        backgroundColor={colors.card}
        nodeVal={(node) => Math.max(1, Math.sqrt(node.degree + 1))}
        nodeColor={nodeColor}
        nodeLabel={graphTooltip}
        linkColor={(link) => {
          if (!activeId) return colors.line;
          return endpointId(link.source) === activeId || endpointId(link.target) === activeId ? colors.ink : colors.line;
        }}
        linkWidth={(link) => (activeId && (endpointId(link.source) === activeId || endpointId(link.target) === activeId) ? 2 : 1)}
        linkLineDash={(link) => (link.kind === "unresolved" ? [4, 3] : null)}
        minZoom={0.25}
        maxZoom={8}
        cooldownTicks={reducedMotion ? 1 : 120}
        autoPauseRedraw
        onNodeHover={(node) => setHoveredId(node?.id ?? null)}
        onNodeClick={(node) => onSelect(node)}
        onNodeDrag={() => graphRef.current?.resumeAnimation()}
        onNodeDragEnd={(node) => {
          node.fx = node.x;
          node.fy = node.y;
          onPinChange(node.id, true);
        }}
        onBackgroundClick={() => onSelect(null)}
      />
    </div>
  );
});
