import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvas = readFileSync(new URL("./GraphCanvas3D.tsx", import.meta.url), "utf8");
const node = readFileSync(new URL("./GraphNode.tsx", import.meta.url), "utf8");
const edge = readFileSync(new URL("./GraphEdge.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./GraphShell.tsx", import.meta.url), "utf8");

describe("GraphCanvas3D", () => {
  it("mounts a perspective force scene with orbit pan and zoom", () => {
    expect(canvas).toContain("from \"@react-three/fiber\"");
    expect(canvas).toContain("PerspectiveCamera");
    expect(canvas).toContain("GRAPH_FOV");
    expect(canvas).toContain("OrbitControls");
    expect(canvas).toContain("enablePan");
    expect(canvas).toContain("enableRotate");
    expect(canvas).toContain("enableZoom");
    expect(canvas).toContain("computeGraphLayout3d");
    expect(canvas).toContain("cameraRigForRadius");
    expect(canvas).toContain("target={rig.target}");
    expect(canvas).toContain("data-graph-hits");
    expect(canvas).toContain("<GraphNode");
    expect(canvas).toContain("<GraphEdge");
    expect(canvas).not.toContain("OrthographicCamera");
    expect(canvas).not.toContain("cytoscape");
    expect(node).toContain("sphereGeometry");
    expect(edge).toContain("from \"@react-three/drei\"");
    expect(edge).toContain("<Line");
    expect(shell).toContain("ssr: false");
    expect(shell).toContain("GraphCanvas3D");
  });
});
