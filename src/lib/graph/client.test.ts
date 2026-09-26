import { describe, expect, it, vi } from "vitest";
import { GRAPH_NODE_KINDS, GRAPH_RELATIONS } from "@/domain/graph/types";
import { fetchGraph } from "./client";

const empty = {
  ok: true as const,
  seedId: null,
  mode: "local" as const,
  nodes: [],
  edges: [],
  truncated: false,
  limit: 120,
};

describe("fetchGraph", () => {
  it("loads GET /api/graph with the session cookie", async () => {
    const load = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => empty,
    });
    const payload = await fetchGraph(
      {
        seedId: null,
        depth: 1,
        kinds: GRAPH_NODE_KINDS,
        relations: GRAPH_RELATIONS,
        mode: "local",
      },
      load,
    );
    expect(load).toHaveBeenCalledWith("/api/graph", { credentials: "include" });
    expect(payload).toEqual(empty);
  });

  it("throws when the payload is not a graph envelope", async () => {
    const load = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, code: "unauthorized" }),
    });
    await expect(
      fetchGraph(
        {
          seedId: null,
          depth: 1,
          kinds: GRAPH_NODE_KINDS,
          relations: GRAPH_RELATIONS,
          mode: "local",
        },
        load,
      ),
    ).rejects.toThrow("graph_load_failed");
  });
});
