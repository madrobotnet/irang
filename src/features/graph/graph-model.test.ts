import { describe, expect, test } from "bun:test";
import type { GraphData } from "@/lib/types";
import { cloneGraphData, graphKey, graphTooltip, neighborIds, stablePaletteIndex, visibleLegendTags } from "./graph-model";

const data: GraphData = {
  nodes: [
    { id: "a", kind: "note", label: "A", tags: ["work", "idea"], degree: 1, updatedAt: null },
    { id: "b", kind: "note", label: "B", tags: ["idea"], degree: 1, updatedAt: null },
  ],
  links: [{ source: "a", target: "b", kind: "link" }],
  focusId: null,
  truncated: false,
};

describe("graph model", () => {
  test("encodes every server-side graph filter", () => {
    expect(graphKey({ focusId: "note-id", depth: 3, includeTags: true, includeOrphans: false, tag: "work" })).toBe(
      "/api/graph?depth=3&tags=1&orphans=0&focus=note-id&tag=work",
    );
  });

  test("clones nested DTO values before force-graph mutates them", () => {
    const cloned = cloneGraphData(data);
    expect(cloned).toEqual({ nodes: data.nodes, links: data.links });
    expect(cloned.nodes[0]).not.toBe(data.nodes[0]);
    expect(cloned.nodes[0]!.tags).not.toBe(data.nodes[0]!.tags);
    expect(cloned.links[0]).not.toBe(data.links[0]);
  });

  test("finds neighbors before and after link endpoint mutation", () => {
    const cloned = cloneGraphData(data);
    expect([...neighborIds(cloned, "a")].sort()).toEqual(["a", "b"]);
    cloned.links[0]!.source = cloned.nodes[0]!;
    cloned.links[0]!.target = cloned.nodes[1]!;
    expect([...neighborIds(cloned, "b")].sort()).toEqual(["a", "b"]);
  });

  test("uses deterministic tag groups and a sorted unique legend", () => {
    expect(stablePaletteIndex("a", 4)).toBe(0);
    expect(stablePaletteIndex("b", 4)).toBe(1);
    expect(visibleLegendTags(data.nodes)).toEqual(["idea", "work"]);
  });

  test("keeps title markup inert at the HTML tooltip boundary", () => {
    const tooltip = graphTooltip({ label: '<b data-qa-tooltip>A & B</b>', degree: 0 });
    expect(tooltip).toStartWith('&lt;b data-qa-tooltip&gt;A &amp; B&lt;/b&gt;');
    expect(tooltip).not.toContain("<");
  });
});
