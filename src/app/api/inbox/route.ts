import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/db/client";
import { listOpenInbox } from "@/lib/inbox/store";
import { currentSession, unauthorized } from "@/lib/notes/http";

const shareSchema = z.object({
  title: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
}).readonly();
type Share = z.infer<typeof shareSchema>;

const insertedSchema = z.object({ id: z.uuid() }).readonly();

function field(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function shareFrom(title: string | undefined, text: string | undefined, url: string | undefined): Share {
  return shareSchema.parse({
    ...(title === undefined ? {} : { title }),
    ...(text === undefined ? {} : { text }),
    ...(url === undefined ? {} : { url }),
  });
}

async function readShare(request: Request): Promise<Share | undefined> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const raw: unknown = await request.json().catch((error: unknown) => {
      if (error instanceof SyntaxError) return null;
      throw error;
    });
    if (raw === null || typeof raw !== "object") return undefined;
    return shareSchema.safeParse(raw).data;
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
  return shareFrom(field(form.get("title")), field(form.get("text")), field(form.get("url")));
}

export async function GET(request: Request): Promise<Response> {
  if (await currentSession(request) === null) return unauthorized();
  return Response.json({ items: await listOpenInbox() });
}

export async function POST(request: Request): Promise<Response> {
  if (await currentSession(request) === null) return unauthorized();
  const share = await readShare(request);
  if (share === undefined) return Response.json({ error: "invalid_request" }, { status: 400 });
  const title = share.title?.trim() || share.text?.trim().slice(0, 80) || "공유";
  const [row] = await getDb()`
    INSERT INTO inbox_items (id, title, body, source_url, created_at)
    VALUES (${randomUUID()}, ${title}, ${share.text ?? ""}, ${share.url ?? null}, ${new Date()})
    RETURNING id
  `;
  return Response.json({ id: insertedSchema.parse(row).id }, { status: 201 });
}
