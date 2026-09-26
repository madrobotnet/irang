import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GRAPH_NODE_KINDS,
  GRAPH_RELATIONS,
  type GraphPayload,
} from "@/domain/graph/types";
import { GRAPH_COPY, GRAPH_KIND_CHIP, GRAPH_RELATION_CHIP } from "@/lib/graph/copy";
import type { GraphViewModel } from "@/lib/graph/view-model";
import { GraphView, type GraphViewProps } from "./GraphView";

const payload: GraphPayload = {
  ok: true,
  seedId: "n1",
  mode: "local",
  nodes: [
    { id: "n1", kind: "note", label: "에이전트 오케스트레이션", status: "draft", updatedAt: "2026-09-26T00:00:00.000Z" },
    { id: "n2", kind: "note", label: "고립", status: "confirmed", updatedAt: "2026-09-25T00:00:00.000Z" },
  ],
  edges: [{ id: "e1", from: "n1", to: "n2", relation: "link", directed: true }],
  truncated: false,
  limit: 120,
};

function noop() {}

function view(model: GraphViewModel, patch: Partial<GraphViewProps> = {}) {
  return renderToStaticMarkup(
    <GraphView
      model={model}
      seedOpen={false}
      inspectorExpanded={false}
      canvas={<div data-graph-canvas="mock">canvas</div>}
      onCapture={noop}
      onRetry={noop}
      onDismissBanner={noop}
      onToggleSeedOpen={noop}
      onSeed={noop}
      onDepth={noop}
      onKind={noop}
      onRelation={noop}
      onAll={noop}
      onToggleInspector={noop}
      {...patch}
    />,
  );
}

function ready(patch: Partial<GraphViewModel> = {}): GraphViewModel {
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

describe("GraphView", () => {
  it("keeps the inspector closed until a node is selected", () => {
    const html = view(ready());
    expect(html).not.toContain("data-graph-inspector");
    expect(html).toContain('data-inspector="off"');
    expect(html).toContain('data-graph-canvas="mock"');
  });

  it("renders the empty sentence and capture CTA", () => {
    const html = view(
      ready({
        payload: { ...payload, nodes: [], edges: [], seedId: null },
      }),
    );
    expect(html).toContain('data-graph-empty="true"');
    expect(html).toContain(GRAPH_COPY.empty);
    expect(html).toContain(GRAPH_COPY.capture);
    expect(html).not.toContain("data-graph-canvas");
    expect(html).not.toContain("3D");
  });

  it("renders the error sentence and retry CTA", () => {
    const html = view(ready({ status: "error", payload: null }));
    expect(html).toContain('data-graph-error="true"');
    expect(html).toContain(GRAPH_COPY.error);
    expect(html).toContain(GRAPH_COPY.retry);
  });

  it("opens the inspector with note and chat links after a select", () => {
    const html = view(ready({ selectedId: "n1" }));
    expect(html).toContain('data-graph-inspector="true"');
    expect(html).toContain("에이전트 오케스트레이션");
    expect(html).toContain(GRAPH_COPY.openNote);
    expect(html).toContain('href="/notes/n1"');
    expect(html).toContain(GRAPH_COPY.chatNode);
    expect(html).toContain("scope=selected");
    expect(html).toContain("selected=n1");
    expect(html).toContain("고립");
    expect(html).toContain('data-graph-canvas="mock"');
  });

  it("wires depth, type, relation, and 전체 chips", () => {
    const html = view(
      ready({
        query: {
          seedId: null,
          depth: 2,
          kinds: ["note"],
          relations: ["link"],
          mode: "full",
        },
        payload: { ...payload, mode: "full", truncated: true },
      }),
    );
    expect(html).toContain('data-graph-filters="true"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(GRAPH_COPY.all);
    expect(html).toContain(GRAPH_COPY.type);
    expect(html).toContain(GRAPH_COPY.relation);
    expect(html).toContain(GRAPH_KIND_CHIP.note);
    expect(html).toContain(GRAPH_RELATION_CHIP.link);
    expect(html).toContain('data-graph-overload="true"');
    expect(html).toContain(GRAPH_COPY.overload);
    expect(html).toContain(">2<");
  });
});
