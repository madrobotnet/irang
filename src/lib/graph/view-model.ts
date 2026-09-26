import type { GraphNode, GraphPayload, GraphQuery } from "@/domain/graph/types";

export type GraphLoadStatus = "loading" | "ready" | "error";

export type GraphViewModel = {
  status: GraphLoadStatus;
  query: GraphQuery;
  payload: GraphPayload | null;
  selectedId: string | null;
  bannerDismissed: boolean;
};

export function graphSurface(model: GraphViewModel): "loading" | "error" | "empty" | "graph" {
  if (model.status === "loading") {
    return "loading";
  }
  if (model.status === "error" || model.payload === null) {
    return "error";
  }
  if (model.payload.nodes.length === 0) {
    return "empty";
  }
  return "graph";
}

export function selectedNode(model: GraphViewModel): GraphNode | null {
  if (!model.selectedId || !model.payload) {
    return null;
  }
  return model.payload.nodes.find((node) => node.id === model.selectedId) ?? null;
}

export function showOverloadBanner(model: GraphViewModel): boolean {
  return (
    model.query.mode === "full" &&
    model.payload?.truncated === true &&
    model.bannerDismissed === false
  );
}
