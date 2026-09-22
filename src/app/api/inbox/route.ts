import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { currentSession, unauthorized } from "@/lib/notes/http";

async function fields(request: Request): Promise<{ title: string; body: string; url: string | null }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const raw: unknown = await request.json().catch((error: unknown) => {
      if (error instanceof SyntaxError) return null;
      throw error;
    });
    const record = raw !== null && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      title: typeof record["title"] === "string" ? record["title"] : "",
      body: typeof record["text"] === "string" ? record["text"] : "",
      url: typeof record["url"] === "string" ? record["url"] : null,
    };
  }
  const form = await request.formData();
  const title = form.get("title");
  const text = form.get("text");
  const url = form.get("url");
  return {
    title: typeof title === "string" ? title : "",
    body: typeof text === "string" ? text : "",
    url: typeof url === "string" && url !== "" ? url : null,
  };
}

export async function POST(request: Request) {
  if (await currentSession(request) === null) return unauthorized();
  const input = await fields(request);
  const title = input.title.trim() || input.body.trim().slice(0, 80) || "공유";
  const [row] = await getDb()`
    INSERT INTO inbox_items (id, title, body, source_url, created_at)
    VALUES (${randomUUID()}, ${title}, ${input.body}, ${input.url}, ${new Date()})
    RETURNING id
  `;
  if (row === undefined) throw new Error("inbox insert returned no row");
  return Response.json({ id: row["id"] }, { status: 201 });
}
