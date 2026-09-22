import { fail as assertNever } from "node:assert/strict";
import {
  contentLengthExceedsLimit,
  decideFile,
  MAX_UPLOAD_BYTES,
  type AllowedUploadMime,
} from "./policy";
import { extractFilePart } from "./multipart";

export type AcceptedUpload = {
  readonly filename: string;
  readonly mime: AllowedUploadMime;
  readonly bytes: Uint8Array;
};

export type UploadAdmission =
  | { readonly kind: "too_large" }
  | { readonly kind: "invalid" }
  | { readonly kind: "unsupported_type" }
  | { readonly kind: "accept"; readonly file: AcceptedUpload };

export async function readAcceptedUpload(request: Request): Promise<UploadAdmission> {
  if (contentLengthExceedsLimit(request.headers.get("content-length"))) return { kind: "too_large" };
  const bounded = await readAtMost(request, MAX_UPLOAD_BYTES);
  if (bounded.kind === "too_large") return bounded;
  const extracted = extractFilePart(request.headers.get("content-type"), bounded.bytes);
  if (extracted.kind === "invalid") return extracted;
  const decision = decideFile({ mime: extracted.file.mime, byteLength: extracted.file.bytes.byteLength });
  switch (decision.kind) {
    case "too_large":
      return { kind: "too_large" };
    case "unsupported_type":
      return { kind: "unsupported_type" };
    case "accept":
      return {
        kind: "accept",
        file: { filename: extracted.file.filename, mime: decision.mime, bytes: extracted.file.bytes },
      };
    default:
      return assertNever(decision);
  }
}

export async function readAtMost(request: Request, maxBytes: number): Promise<
  { readonly kind: "too_large" } | { readonly kind: "bytes"; readonly bytes: Uint8Array }
> {
  const body = request.body;
  if (body === null) return { kind: "bytes", bytes: new Uint8Array() };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { kind: "too_large" };
    }
    chunks.push(step.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { kind: "bytes", bytes };
}
