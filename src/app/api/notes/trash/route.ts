import { json, withApi } from "@/server/http";
import { emptyTrash } from "@/server/notes/trash";

export const runtime = "nodejs";

export const DELETE = withApi(async () => json(await emptyTrash()));
