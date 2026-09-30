import { z } from "zod";
import { json, parseJson, withApi } from "@/server/http";
import { toggleNoteTask } from "@/server/tasks/service";

export const runtime = "nodejs";

const ToggleBody = z.object({
  noteId: z.string().max(100),
  line: z.number().int().min(1).max(1_000_000),
  expectedText: z.string().max(100_000),
  done: z.boolean(),
}).strict();

export const POST = withApi(async (request) => json(await toggleNoteTask(await parseJson(request, ToggleBody))));
