import { handleGetHome } from "@/server/home/http";

export const runtime = "nodejs";

export function GET(): Promise<Response> {
  return handleGetHome();
}
