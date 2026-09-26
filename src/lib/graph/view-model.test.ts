import { describe, expect, it } from "vitest";
import { GRAPH_NODE_KINDS, GRAPH_RELATIONS, type GraphPayload } from "@/domain/graph/types";
import { graphSurface, selectedNode, showOverloadBanner, type GraphViewModel } from "./view-model";

const payload: GraphPayload = {
  ok: true,
  seedId: "n1",
  mode: "local",
  nodes: [
    { id: "n1", kind: "note", label: "시드", status: "draft", updatedAt: "2026-01-01T00:00:00.000Z" },
  ],
  edges: [],
  truncated: false,
  limit: 120,
};

function model(patch: Partial<GraphViewModel> = {}): GraphViewModel {
  return {
    status: "ready",
    query: {
      seedId: "n1",
      depth: 1,
      kinds: GRAPH_NODE_KINDS,
      relations: GRAPH_RELATIONS,
      mode: "local",
    },
    payload,
    selectedId: null,
    bannerDismissed: false,
    ...patch,
  };
}

describe("graph view model", () => {
  it("maps empty, error, and selected states", () => {
    expect(graphSurface(model({ payload: { ...payload, nodes: [], edges: [] } }))).toBe("empty");
    expect(graphSurface(model({ status: "error", payload: null }))).toBe("error");
    expect(selectedNode(model({ selectedId: "n1" }))?.label).toBe("시드");
    expect(
      showOverloadBanner(
        model({
          query: { ...model().query, mode: "full" },
          payload: { ...payload, mode: "full", truncated: true },
        }),
      ),
    ).toBe(true);
  });
});
