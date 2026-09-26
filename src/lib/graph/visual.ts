import type { GraphNodeKind } from "@/domain/graph/types";

export const GRAPH_CANVAS_HEX = "#110e16";
export const GRAPH_ACCENT_HEX = "#c4b5fd";

export const GRAPH_KIND_COLOR: Record<GraphNodeKind, string> = {
  note: "#e9e0ff",
  concept: "#a78bfa",
  source: "#6f6584",
  inbox: "#e8c4d8",
};
