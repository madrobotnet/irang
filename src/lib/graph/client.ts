import type { GraphPayload, GraphQuery } from "@/domain/graph/types";
import { parseGraphPayload } from "./parse";
import { graphApiHref } from "./query";

export async function fetchGraph(query: GraphQuery, load: typeof fetch = fetch): Promise<GraphPayload> {
  const response = await load(graphApiHref(query), { credentials: "include" });
  const body: unknown = await response.json();
  const payload = parseGraphPayload(body);
  if (!response.ok || !payload) {
    throw new Error("graph_load_failed");
  }
  return payload;
}
