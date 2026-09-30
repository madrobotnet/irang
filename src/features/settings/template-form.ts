import { ApiClientError } from "@/lib/api-client";
import { TEMPLATE_BODY_MAX, TEMPLATE_NAME_MAX, type NoteTemplate } from "@/lib/templates";

export type TemplateDraft = { name: string; body: string; isDailyDefault: boolean };
export type TemplateDraftErrors = { name?: "required" | "tooLong"; body?: "tooLong" };

export const EMPTY_TEMPLATE_DRAFT: TemplateDraft = { name: "", body: "", isDailyDefault: false };

export function draftFromTemplate(template: NoteTemplate): TemplateDraft {
  return { name: template.name, body: template.body, isDailyDefault: template.isDailyDefault };
}

export function validateTemplateDraft(draft: TemplateDraft): TemplateDraftErrors {
  const errors: TemplateDraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "required";
  else if (name.length > TEMPLATE_NAME_MAX) errors.name = "tooLong";
  if (draft.body.length > TEMPLATE_BODY_MAX) errors.body = "tooLong";
  return errors;
}

export const hasDraftErrors = (errors: TemplateDraftErrors): boolean => Boolean(errors.name || errors.body);

export function templateCreateBody(draft: TemplateDraft): TemplateDraft {
  return { name: draft.name.trim(), body: draft.body, isDailyDefault: draft.isDailyDefault };
}

/** Only the fields that changed, since PATCH rejects an empty patch; `{}` means there is nothing to save. */
export function templatePatch(original: NoteTemplate, draft: TemplateDraft): Partial<TemplateDraft> {
  const patch: Partial<TemplateDraft> = {};
  const name = draft.name.trim();
  if (name !== original.name) patch.name = name;
  if (draft.body !== original.body) patch.body = draft.body;
  if (draft.isDailyDefault !== original.isDailyDefault) patch.isDailyDefault = draft.isDailyDefault;
  return patch;
}

/** A 409 on save means the name is taken, so its message belongs beside the name field. */
export function templateErrorField(error: unknown): "name" | "form" {
  return error instanceof ApiClientError && error.status === 409 ? "name" : "form";
}

export function templatePreview(body: string): string {
  return body.split(/\r\n|\n|\r/).find((line) => line.trim())?.trim() ?? "";
}
