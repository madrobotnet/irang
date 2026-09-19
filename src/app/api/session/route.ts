import { handleMe } from "@/server/auth/http";

export const runtime = "nodejs";

/** Contract alias for GET /api/auth/me */
export async function GET(request: Request) {
  return handleMe(request);
}
