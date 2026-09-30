import { z } from "zod";
import { localizedIssue } from "@/lib/i18n/validation";
import { TEMPLATE_BODY_MAX, TEMPLATE_NAME_MAX } from "@/lib/templates";
import { json, parseJson, withApi } from "@/server/http";
import { templatesCopy } from "@/server/templates/copy";
import { deleteTemplate, updateTemplate } from "@/server/templates/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

const UpdateBody = z.object({
  name: z.string().trim().min(1).max(TEMPLATE_NAME_MAX).optional(),
  body: z.string().max(TEMPLATE_BODY_MAX).optional(),
  isDailyDefault: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { ...localizedIssue(templatesCopy.patchEmpty) });

export const PATCH = withApi<Context>(async (request, { params }) => {
  const { id } = await params;
  return json({ template: await updateTemplate(id, await parseJson(request, UpdateBody)) });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  await deleteTemplate(id);
  return json({ ok: true });
});
