import { z } from "zod";
import { TypeSafeMisconfiguredError, selectEvidence } from "@/lib/jev/client";
import { currentSession, unauthorized } from "@/lib/notes/http";
import { keywordSearch } from "@/lib/search/store";

const bodySchema = z.object({ question: z.string().min(1) }).readonly();

export async function POST(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  const raw: unknown = await request.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  const input = bodySchema.safeParse(raw).data;
  if (input === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });
  try {
    const candidates = await keywordSearch(input.question);
    const evidence = await selectEvidence(input.question, candidates);
    return Response.json({
      evidence: evidence.map((item) => ({ noteId: item.id, probability: item.probability })),
    });
  } catch (error) {
    if (error instanceof TypeSafeMisconfiguredError) {
      return Response.json({ error: "typesafe_misconfigured" }, { status: 503 });
    }
    throw error;
  }
}
