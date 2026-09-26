import { handleCreateLink } from "@/server/graph/http";

export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return handleCreateLink(request);
}
