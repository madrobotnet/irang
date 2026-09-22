import { handleManageSuggest } from "@/server/chat/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleManageSuggest(request);
}
