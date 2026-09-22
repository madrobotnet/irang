import { handleEvidence } from "@/server/search/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleEvidence(request);
}

export async function POST(request: Request) {
  return handleEvidence(request);
}
