import { handleLogin } from "@/server/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleLogin(request);
}
