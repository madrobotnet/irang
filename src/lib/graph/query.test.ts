import { describe, expect, it } from "vitest";
import { GRAPH_NODE_KINDS, GRAPH_RELATIONS } from "@/domain/graph/types";
import {
  graphApiHref,
  graphChatHref,
  graphNotePath,
  graphOpenFromNoteHref,
  graphQueryFromSearch,
  toggleKind,
} from "./query";

describe("graph query", () => {
  it("omits default local depth-1 from the API href", () => {
    expect(
      graphApiHref({
        seedId: null,
        depth: 1,
        kinds: GRAPH_NODE_KINDS,
        relations: GRAPH_RELATIONS,
        mode: "local",
      }),
    ).toBe("/api/graph");
  });

  it("builds seed, depth, kinds, and full mode into the href", () => {
    const href = graphApiHref({
      seedId: "11111111-1111-4111-8111-111111111111",
      depth: 2,
      kinds: ["note", "inbox"],
      relations: ["link"],
      mode: "full",
    });
    expect(href).toBe(
      "/api/graph?depth=2&kinds=note%2Cinbox&relations=link&mode=full",
    );
  });

  it("reads filters from the page search string", () => {
    expect(graphQueryFromSearch(new URLSearchParams("seedId=abc&depth=3&mode=full"))).toEqual({
      seedId: null,
      depth: 3,
      kinds: [...GRAPH_NODE_KINDS],
      relations: [...GRAPH_RELATIONS],
      mode: "full",
    });
  });

  it("keeps at least one kind selected", () => {
    expect(toggleKind(["note"], "note")).toEqual(["note"]);
  });

  it("builds note and chat hrefs from a node id", () => {
    expect(graphNotePath("n1")).toBe("/notes/n1");
    expect(graphChatHref("n1")).toBe("/chat?scope=selected&selected=n1");
    expect(graphOpenFromNoteHref("n1")).toBe("/graph?seedId=n1");
  });
});
