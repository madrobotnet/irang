import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "@/domain/graph/types";
import {
  cameraRigForRadius,
  computeGraphLayout3d,
  GRAPH_LAYOUT_SPAN,
  layoutGraph3d,
  nodeDegree,
} from "./layout";

const nodes: GraphNode[] = [
  { id: "a", kind: "note", label: "A", status: "draft", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "b", kind: "note", label: "B", status: "draft", updatedAt: "2026-01-02T00:00:00.000Z" },
  { id: "c", kind: "note", label: "C", status: "draft", updatedAt: "2026-01-03T00:00:00.000Z" },
];

const edges: GraphEdge[] = [
  { id: "e-ab", from: "a", to: "b", relation: "link", directed: true },
];

describe("layoutGraph3d", () => {
  it("places every node in 3D including an isolate", () => {
    const points = layoutGraph3d(nodes, edges);
    expect([...points.keys()].sort()).toEqual(["a", "b", "c"]);
    for (const point of points.values()) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(Number.isFinite(point.z)).toBe(true);
    }
    const zs = [...points.values()].map((point) => point.z);
    expect(zs.some((z) => z !== 0)).toBe(true);
    expect(nodeDegree("a", edges)).toBe(1);
    expect(nodeDegree("c", edges)).toBe(0);
  });

  it("recenters the cloud on the origin and keeps it in a camera-fit span", () => {
    const { points, radius } = computeGraphLayout3d(nodes, edges);
    const values = [...points.values()];
    const cx = values.reduce((sum, point) => sum + point.x, 0) / values.length;
    const cy = values.reduce((sum, point) => sum + point.y, 0) / values.length;
    const cz = values.reduce((sum, point) => sum + point.z, 0) / values.length;
    expect(Math.abs(cx)).toBeLessThan(0.05);
    expect(Math.abs(cy)).toBeLessThan(0.05);
    expect(Math.abs(cz)).toBeLessThan(0.05);
    expect(radius).toBeLessThanOrEqual(GRAPH_LAYOUT_SPAN + 0.01);
    for (const point of values) {
      expect(Math.hypot(point.x, point.y, point.z)).toBeLessThanOrEqual(GRAPH_LAYOUT_SPAN + 0.05);
    }
    const rig = cameraRigForRadius(radius);
    expect(rig.target).toEqual([0, 0, 0]);
    expect(rig.position[2]).toBeGreaterThan(rig.position[1]);
    expect(rig.position[1]).toBeGreaterThan(0);
  });
});
