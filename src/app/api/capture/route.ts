import { z } from "zod";
import { summarizeHtml } from "@/lib/capture/summary";
import { recordFailedJob } from "@/lib/jobs/store";
import { TypeSafeMisconfiguredError, judgeDuplicates } from "@/lib/jev/client";
import { currentSession, unauthorized } from "@/lib/notes/http";
import { createNote, listActiveNotes } from "@/lib/notes/store";

const PAGE_BYTE_LIMIT = 262_144;
const FETCH_TIMEOUT_MS = 10_000;

const captureBody = z.object({
  url: z.url().refine((value) => isHttp(value)),
}).readonly();

class PageFetchError extends Error {
  readonly name = "PageFetchError";

  constructor(readonly detail: string) {
    super("page_fetch_failed");
  }
}

function isHttp(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

async function readCaptureUrl(request: Request): Promise<string | undefined> {
  const raw: unknown = await request.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  return captureBody.safeParse(raw).data?.url;
}

async function readBounded(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (reader === undefined) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  let stoppedEarly = false;
  while (total < PAGE_BYTE_LIMIT) {
    const next = await reader.read();
    if (next.done) break;
    const value = next.value;
    if (value === undefined) continue;
    const remaining = PAGE_BYTE_LIMIT - total;
    const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
    chunks.push(slice);
    total += slice.byteLength;
    stoppedEarly = value.byteLength > remaining;
    if (stoppedEarly) break;
  }
  if (stoppedEarly) await reader.cancel();
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function readPage(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html, text/plain;q=0.9",
        "user-agent": "SecondBrainCapture/1.0",
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new PageFetchError("timeout");
    if (error instanceof TypeError || error instanceof DOMException) throw new PageFetchError("network");
    throw error;
  }
  if (!response.ok) throw new PageFetchError(`status ${response.status}`);
  if (response.url !== "" && !isHttp(response.url)) throw new PageFetchError("redirect");
  return readBounded(response);
}

export async function POST(request: Request): Promise<Response> {
  if (await currentSession(request) === null) return unauthorized();
  const url = await readCaptureUrl(request);
  if (url === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });
  try {
    const summary = summarizeHtml(await readPage(url), url);
    const judgment = await judgeDuplicates({
      incoming: { title: summary.title, body: summary.body, url },
      candidates: (await listActiveNotes()).map((note) => ({
        id: note.id,
        title: note.title,
        body: note.body,
      })),
    });
    const note = await createNote({ title: summary.title, body: summary.body });
    return Response.json({
      noteId: note.id,
      candidates: judgment.candidates.map((candidate) => ({
        noteId: candidate.id,
        probability: candidate.probability,
      })),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TypeSafeMisconfiguredError) {
      return Response.json({ error: "typesafe_misconfigured" }, { status: 503 });
    }
    if (error instanceof PageFetchError) {
      await recordFailedJob("capture", error.detail, { url });
      return Response.json({ error: "capture_failed" }, { status: 502 });
    }
    throw error;
  }
}
