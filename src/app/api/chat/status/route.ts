import { getChatStatus } from "@/server/chat/service";
import { json, withApi } from "@/server/http";

export const runtime = "nodejs";
export const GET = withApi(async () => json(await getChatStatus()));
