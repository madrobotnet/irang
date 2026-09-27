import { json, withApi } from "@/server/http";
import { listTags } from "@/server/notes/service";

export const GET = withApi(async () => json({ tags: await listTags() }));
