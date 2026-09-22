import { handleSearch } from "@/server/search/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleSearch(request);
}

export async function POST(request: Request) {
  return handleSearch(request);
}
