import { z } from "zod";
import { CodexMisconfiguredError } from "@/lib/chat/provider";
import { reply } from "@/lib/chat/store";
import { TypeSafeMisconfiguredError } from "@/lib/jev/client";
import { currentSession, unauthorized } from "@/lib/notes/http";
import { getDb } from "@/db/client";

const bodySchema = z.object({ question: z.string().min(1) }).readonly();

export async function POST(request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  if (await currentSession(request) === null) return unauthorized();
  const raw: unknown = await request.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  const input = bodySchema.safeParse(raw).data;
  if (input === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });
  const notes = await getDb()`
    SELECT id, title, body FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC
  `;
  try {
    const result = await reply((await context.params).id, input.question, notes.map((row) => ({
      id: String(row["id"]),
      title: String(row["title"]),
      body: String(row["body"]),
    })));
    return Response.json({
      body: result.body,
      citations: result.citations.map((id) => `/notes/${id}`),
    });
  } catch (error) {
    if (error instanceof CodexMisconfiguredError) return Response.json({ error: "codex_misconfigured" }, { status: 503 });
    if (error instanceof TypeSafeMisconfiguredError) return Response.json({ error: "typesafe_misconfigured" }, { status: 503 });
    throw error;
  }
}
