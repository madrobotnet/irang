import { describe, expect, it } from "vitest";
import { GRAPH_NODE_LIMIT } from "@/domain/graph/types";
import { parseGraphPayload } from "./parse";

const node = {
  id: "n1",
  kind: "note",
  label: "에이전트",
  status: "draft",
  updatedAt: "2026-09-26T00:00:00.000Z",
};

const edge = {
  id: "e1",
  from: "n1",
  to: "n2",
  relation: "link",
  directed: true,
};

describe("parseGraphPayload", () => {
  it("accepts the contract envelope", () => {
    expect(
      parseGraphPayload({
        ok: true,
        seedId: "n1",
        mode: "local",
        nodes: [node],
        edges: [edge],
        truncated: false,
        limit: GRAPH_NODE_LIMIT,
      }),
    ).toEqual({
      ok: true,
      seedId: "n1",
      mode: "local",
      nodes: [node],
      edges: [edge],
      truncated: false,
      limit: GRAPH_NODE_LIMIT,
    });
  });

  it("rejects a payload that includes coordinates or a missing directed flag", () => {
    expect(
      parseGraphPayload({
        ok: true,
        seedId: null,
        mode: "local",
        nodes: [{ ...node, x: 1, y: 2, z: 3 }],
        edges: [edge],
        truncated: false,
        limit: 120,
      }),
    ).toEqual({
      ok: true,
      seedId: null,
      mode: "local",
      nodes: [node],
      edges: [edge],
      truncated: false,
      limit: 120,
    });
    expect(
      parseGraphPayload({
        ok: true,
        seedId: null,
        mode: "local",
        nodes: [node],
        edges: [{ ...edge, directed: false }],
        truncated: false,
        limit: 120,
      }),
    ).toBeNull();
  });
});
