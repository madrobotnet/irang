import { currentSession, unauthorized } from "@/lib/notes/http";
import { contentLengthExceedsLimit } from "@/lib/uploads/policy";
import { readAcceptedUpload } from "@/lib/uploads/read";
import { storeUpload } from "@/lib/uploads/store";

class UnexpectedUploadDecisionError extends Error {
  readonly name = "UnexpectedUploadDecisionError";

  constructor(readonly decision: never) {
    super("unexpected upload decision");
  }
}

function assertNever(decision: never): never {
  throw new UnexpectedUploadDecisionError(decision);
}

export async function POST(request: Request): Promise<Response> {
  if (contentLengthExceedsLimit(request.headers.get("content-length"))) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }
  if (await currentSession(request) === null) return unauthorized();
  const admission = await readAcceptedUpload(request);
  switch (admission.kind) {
    case "too_large":
      return Response.json({ error: "payload_too_large" }, { status: 413 });
    case "invalid":
      return Response.json({ error: "invalid_request" }, { status: 400 });
    case "unsupported_type":
      return Response.json({ error: "unsupported_media_type" }, { status: 415 });
    case "accept": {
      const stored = await storeUpload(admission.file);
      return Response.json({
        id: stored.id,
        filename: stored.filename,
        mime: stored.mime,
        byteSize: stored.byteSize,
        storageKey: stored.storageKey,
      }, { status: 201 });
    }
    default:
      return assertNever(admission);
  }
}
