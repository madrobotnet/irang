import { fail as assertNever } from "node:assert/strict";
import type { NextRequest } from "next/server";
import { resolveSession, SESSION_COOKIE } from "@/lib/auth/session";
import { readAcceptedUpload } from "@/lib/uploads/read";
import { storeUpload } from "@/lib/uploads/store";

function jsonError(status: 400 | 401 | 413 | 415, error: string): Response {
  return Response.json({ error }, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await resolveSession(token) : null;
  if (session === null) return jsonError(401, "unauthorized");

  const admission = await readAcceptedUpload(request);
  switch (admission.kind) {
    case "too_large":
      return jsonError(413, "payload_too_large");
    case "invalid":
      return jsonError(400, "invalid_request");
    case "unsupported_type":
      return jsonError(415, "unsupported_media_type");
    case "accept": {
      const stored = await storeUpload(admission.file);
      return Response.json({
        id: stored.id,
        filename: stored.filename,
        mime: stored.mime,
        byteSize: stored.byteSize,
        storageKey: stored.storageKey,
        createdAt: stored.createdAt.toISOString(),
      }, { status: 201 });
    }
    default:
      return assertNever(admission);
  }
}
