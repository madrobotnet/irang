import { handleGetGraph } from "@/server/graph/http";

export const runtime = "nodejs";

export function GET(request: Request): Promise<Response> {
  return handleGetGraph(request);
}
