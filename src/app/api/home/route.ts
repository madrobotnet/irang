import { getHomeData } from "@/server/home";
import { json, withApi } from "@/server/http";

export const runtime = "nodejs";

export const GET = withApi(async () => json(await getHomeData()));
