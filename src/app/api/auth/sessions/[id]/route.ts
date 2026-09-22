import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSession, revokeById, SESSION_COOKIE } from "@/lib/auth/session";

const sessionId = z.uuid().brand("SessionId");

export async function DELETE(request: NextRequest, context: { readonly params: Promise<{ readonly id: string }> }) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await resolveSession(token) : null;
  if (session === null) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = sessionId.safeParse((await context.params).id).data;
  if (id === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });
  await revokeById(id);
  return new Response(null, { status: 204 });
}
