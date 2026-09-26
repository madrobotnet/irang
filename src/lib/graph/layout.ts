import { forceCenter, forceLink, forceManyBody, forceSimulation, forceZ } from "d3-force-3d";
import type { GraphEdge, GraphNode } from "@/domain/graph/types";

export type LayoutPoint = { x: number; y: number; z: number };

export type GraphLayout3d = {
  points: Map<string, LayoutPoint>;
  radius: number;
};

/** Vertical field of view for GraphCanvas3D (perspective, not ortho). */
export const GRAPH_FOV = 42;

/** Post-sim cloud is scaled so the farthest node is at most this from origin. */
export const GRAPH_LAYOUT_SPAN = 10;

type SimNode = {
  id: string;
  x: number;
  y: number;
  z: number;
};

type SimLink = {
  source: string;
  target: string;
};

export function cameraRigForRadius(radius: number): {
  position: [number, number, number];
  target: [number, number, number];
} {
  const r = Math.max(radius, 4);
  const dist = Math.max(16, (r / Math.tan((GRAPH_FOV * Math.PI) / 360)) * 1.28);
  return {
    position: [r * 0.18, r * 0.55, dist],
    target: [0, 0, 0],
  };
}

function recenterAndScale(simNodes: SimNode[]): number {
  if (simNodes.length === 0) {
    return GRAPH_LAYOUT_SPAN / 2;
  }
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const node of simNodes) {
    cx += node.x;
    cy += node.y;
    cz += node.z;
  }
  const count = simNodes.length;
  cx /= count;
  cy /= count;
  cz /= count;
  let maxR = 0;
  for (const node of simNodes) {
    node.x -= cx;
    node.y -= cy;
    node.z -= cz;
    maxR = Math.max(maxR, Math.hypot(node.x, node.y, node.z));
  }
  if (maxR > GRAPH_LAYOUT_SPAN && maxR > 0) {
    const scale = GRAPH_LAYOUT_SPAN / maxR;
    for (const node of simNodes) {
      node.x *= scale;
      node.y *= scale;
      node.z *= scale;
    }
    maxR = GRAPH_LAYOUT_SPAN;
  }
  return Math.max(maxR, 4);
}

export function computeGraphLayout3d(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): GraphLayout3d {
  const simNodes: SimNode[] = nodes.map((node, index) => {
    const angle = index * 2.399963;
    const radius = 2.4 + (index % 5) * 0.35;
    return {
      id: node.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle * 0.7) * 1.1,
      z: Math.sin(angle) * radius,
    };
  });
  const ids = new Set(simNodes.map((node) => node.id));
  const simLinks: SimLink[] = edges
    .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
    .map((edge) => ({ source: edge.from, target: edge.to }));

  const simulation = forceSimulation(simNodes, 3)
    .force(
      "link",
      forceLink<SimNode>(simLinks)
        .id((node) => node.id)
        .distance(6.5)
        .strength(0.7),
    )
    .force("charge", forceManyBody().strength(-14))
    .force("center", forceCenter(0, 0, 0))
    .force("z", forceZ(0).strength(0.18))
    .stop();

  simulation.tick(160);
  const radius = recenterAndScale(simNodes);

  const points = new Map<string, LayoutPoint>();
  for (const node of simNodes) {
    points.set(node.id, { x: node.x, y: node.y, z: node.z });
  }
  return { points, radius };
}

export function layoutGraph3d(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Map<string, LayoutPoint> {
  return computeGraphLayout3d(nodes, edges).points;
}

export function nodeDegree(id: string, edges: readonly GraphEdge[]): number {
  let count = 0;
  for (const edge of edges) {
    if (edge.from === id || edge.to === id) {
      count += 1;
    }
  }
  return count;
}
