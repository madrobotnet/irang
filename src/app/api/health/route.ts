import { handleHealth } from "@/server/auth/http";

export const runtime = "nodejs";

export async function GET() {
  return handleHealth();
}
