import { handleMe } from "@/server/auth/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleMe(request);
}
