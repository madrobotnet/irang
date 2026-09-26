"use client";

import { Line } from "@react-three/drei";
import type { GraphEdge as GraphEdgeDto } from "@/domain/graph/types";
import type { LayoutPoint } from "@/lib/graph/layout";

export type GraphEdgeProps = {
  edge: GraphEdgeDto;
  from: LayoutPoint;
  to: LayoutPoint;
};

export function GraphEdge({ edge, from, to }: GraphEdgeProps) {
  const midZ = (from.z + to.z) / 2;
  const opacity = Math.max(0.16, Math.min(0.55, 0.42 - midZ / 80));
  const color = edge.relation === "suggested" ? "#a898bc" : "#c9bdd8";
  return (
    <Line
      points={[
        [from.x, from.y, from.z],
        [to.x, to.y, to.z],
      ]}
      color={color}
      lineWidth={0.7}
      transparent
      opacity={opacity}
      depthWrite={false}
    />
  );
}
