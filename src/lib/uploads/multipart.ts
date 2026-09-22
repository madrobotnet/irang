export type ExtractedFile = {
  readonly filename: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
};

export type ExtractResult =
  | { readonly kind: "invalid" }
  | { readonly kind: "file"; readonly file: ExtractedFile };

const encoder = new TextEncoder();
const headerBreak = encoder.encode("\r\n\r\n");

export function multipartBoundary(contentType: string): string | null {
  const lower = contentType.toLowerCase();
  if (!lower.startsWith("multipart/form-data")) return null;
  const marker = "boundary=";
  const at = lower.indexOf(marker);
  if (at < 0) return null;
  const raw = contentType.slice(at + marker.length).trim();
  if (raw.startsWith("\"")) {
    const end = raw.indexOf("\"", 1);
    return end > 1 ? raw.slice(1, end) : null;
  }
  const stop = raw.search(/[;\s]/u);
  const value = (stop === -1 ? raw : raw.slice(0, stop)).trim();
  return value.length > 0 ? value : null;
}

export function extractFilePart(contentType: string | null, body: Uint8Array): ExtractResult {
  if (contentType === null) return { kind: "invalid" };
  const boundary = multipartBoundary(contentType);
  if (boundary === null) return { kind: "invalid" };
  const delimiter = encoder.encode(`--${boundary}`);
  const separator = encoder.encode(`\r\n--${boundary}`);
  let cursor = indexOfBytes(body, delimiter, 0);
  if (cursor < 0) return { kind: "invalid" };
  cursor += delimiter.length;
  while (cursor < body.length) {
    if (body[cursor] === 45 && body[cursor + 1] === 45) return { kind: "invalid" };
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;
    const headersEnd = indexOfBytes(body, headerBreak, cursor);
    if (headersEnd < 0) return { kind: "invalid" };
    const headerText = new TextDecoder().decode(body.subarray(cursor, headersEnd));
    const bodyStart = headersEnd + headerBreak.length;
    const next = indexOfBytes(body, separator, bodyStart);
    if (next < 0) return { kind: "invalid" };
    const file = fileFromHeaders(headerText, body.slice(bodyStart, next));
    if (file !== null) return { kind: "file", file };
    cursor = next + separator.length;
  }
  return { kind: "invalid" };
}

function fileFromHeaders(headerText: string, bytes: Uint8Array): ExtractedFile | null {
  const headers = headerFields(headerText);
  const disposition = headers.get("content-disposition");
  if (disposition === undefined) return null;
  if (dispositionParam(disposition, "name") !== "file") return null;
  const filename = dispositionParam(disposition, "filename");
  if (filename === null) return null;
  return { filename, mime: headers.get("content-type") ?? "", bytes };
}

function headerFields(headerText: string): ReadonlyMap<string, string> {
  const fields = new Map<string, string>();
  for (const line of headerText.split("\r\n")) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!fields.has(name)) fields.set(name, line.slice(colon + 1).trim());
  }
  return fields;
}

function dispositionParam(disposition: string, key: string): string | null {
  for (const part of disposition.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq).toLowerCase() !== key) continue;
    const raw = trimmed.slice(eq + 1).trim();
    if (raw.startsWith("\"") && raw.endsWith("\"") && raw.length >= 2) return raw.slice(1, -1);
    return raw;
  }
  return null;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  const last = haystack.length - needle.length;
  for (let i = from; i <= last; i++) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}
