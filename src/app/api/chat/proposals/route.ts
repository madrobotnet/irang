import { handleListProposals } from "@/server/chat/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleListProposals(request);
}
