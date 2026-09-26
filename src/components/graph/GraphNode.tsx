"use client";

import { Html } from "@react-three/drei";
import type { GraphNode as GraphNodeDto } from "@/domain/graph/types";
import { GRAPH_ACCENT_HEX, GRAPH_KIND_COLOR } from "@/lib/graph/visual";
import type { LayoutPoint } from "@/lib/graph/layout";

export type GraphNodeProps = {
  node: GraphNodeDto;
  position: LayoutPoint;
  selected: boolean;
  hovered: boolean;
  degree: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function GraphNode({
  node,
  position,
  selected,
  hovered,
  degree,
  onSelect,
  onHover,
}: GraphNodeProps) {
  const radius = 0.72 + Math.min(degree, 8) * 0.1 + (selected ? 0.28 : 0);
  const color = GRAPH_KIND_COLOR[node.kind];
  const hoverPeek =
    hovered && typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
  const showLabel = selected || hoverPeek;
  const pick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect(node.id);
  };
  return (
    <group position={[position.x, position.y, position.z]}>
      {selected ? (
        <mesh>
          <sphereGeometry args={[radius + 0.18, 24, 24]} />
          <meshBasicMaterial color={GRAPH_ACCENT_HEX} transparent opacity={0.28} />
        </mesh>
      ) : null}
      <mesh
        onPointerDown={pick}
        onClick={pick}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(node.id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={selected || hovered ? GRAPH_ACCENT_HEX : color}
          emissiveIntensity={selected ? 0.55 : hovered ? 0.28 : 0.08}
          roughness={0.35}
          metalness={0.08}
        />
      </mesh>
      {showLabel ? (
        <Html center sprite distanceFactor={22} style={{ pointerEvents: "none" }}>
          <div
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              background: "rgba(17,14,22,0.88)",
              color: "#f7f2fc",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {node.label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
