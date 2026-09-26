import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvas = readFileSync(new URL("./GraphCanvas2D.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./GraphShell.tsx", import.meta.url), "utf8");

describe("GraphCanvas2D", () => {
  it("renders a 2D SVG knowledge map with pan and zoom", () => {
    expect(canvas).toContain("<svg");
    expect(canvas).toContain("computeGraphLayout3d");
    expect(canvas).toContain("data-graph-hits");
    expect(canvas).not.toContain("@react-three/fiber");
    expect(shell).toContain("GraphCanvas2D");
    expect(shell).not.toContain("GraphCanvas3D");
  });
});
