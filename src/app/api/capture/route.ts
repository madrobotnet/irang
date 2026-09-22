import { z } from "zod";
import { recordFailedJob } from "@/lib/jobs/store";
import { TypeSafeMisconfiguredError, judgeDuplicates } from "@/lib/jev/client";
import { summarizeHtml } from "@/lib/capture/summary";
import { currentSession, unauthorized } from "@/lib/notes/http";
import { createNote, listActiveNotes } from "@/lib/notes/store";

const captureBody = z.object({ url: z.url() }).readonly();

export async function POST(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  const raw: unknown = await request.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  const input = captureBody.safeParse(raw).data;
  if (input === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });

  const response = await fetch(input.url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    await recordFailedJob("capture", `status ${response.status}`, { url: input.url });
    return Response.json({ error: "capture_failed" }, { status: 502 });
  }
  const summary = summarizeHtml(await response.text(), input.url);
  const existing = await listActiveNotes();
  try {
    const judgment = await judgeDuplicates({
      incoming: { title: summary.title, body: summary.body, url: input.url },
      candidates: existing.map((note) => ({ id: note.id, title: note.title, body: note.body })),
    });
    const note = await createNote(summary);
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
    throw error;
  }
}
