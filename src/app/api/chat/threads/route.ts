import { z } from "zod";
import { createThread } from "@/lib/chat/store";
import { currentSession, unauthorized } from "@/lib/notes/http";
import { getDb } from "@/db/client";

const bodySchema = z.object({ title: z.string().min(1) }).readonly();

export async function GET(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  const rows = await getDb()`SELECT id, title FROM chat_threads ORDER BY created_at DESC`;
  return Response.json({ threads: rows.map((row) => ({ id: String(row["id"]), title: String(row["title"]) })) });
}

export async function POST(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  const raw: unknown = await request.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  const input = bodySchema.safeParse(raw).data;
  if (input === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });
  return Response.json({ id: await createThread(input.title) }, { status: 201 });
}
