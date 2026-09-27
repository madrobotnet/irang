import { json, withApi } from "@/server/http";
import { listInbox } from "@/server/inbox";

export const runtime = "nodejs";

export const GET = withApi(async () => json(await listInbox()));
