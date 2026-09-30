import { z } from "zod";
import { TEMPLATE_BODY_MAX, TEMPLATE_NAME_MAX } from "@/lib/templates";
import { json, parseJson, withApi } from "@/server/http";
import { createTemplate, listTemplates } from "@/server/templates/service";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(TEMPLATE_NAME_MAX),
  body: z.string().max(TEMPLATE_BODY_MAX).optional(),
  isDailyDefault: z.boolean().optional(),
}).strict();

export const GET = withApi(async () => json({ templates: await listTemplates() }));

export const POST = withApi(async (request) => {
  const input = await parseJson(request, CreateBody);
  return json({ template: await createTemplate(input) }, { status: 201 });
});
