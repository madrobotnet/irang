import { z } from "zod";
import { json, withApi } from "@/server/http";
import { listTasks } from "@/server/tasks/service";

export const runtime = "nodejs";

const ListQuery = z.object({ state: z.enum(["open", "done", "all"]).default("open") }).strict();

export const GET = withApi(async (request) => {
  const { state } = ListQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  return json(await listTasks(state));
});
