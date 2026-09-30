import { describe, expect, test } from "bun:test";
import { ApiClientError } from "@/lib/api-client";
import { TEMPLATE_BODY_MAX, TEMPLATE_NAME_MAX, type NoteTemplate } from "@/lib/templates";
import {
  draftFromTemplate, EMPTY_TEMPLATE_DRAFT, hasDraftErrors, templateCreateBody, templateErrorField, templatePatch,
  templatePreview, validateTemplateDraft,
} from "./template-form";

const template: NoteTemplate = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Meeting",
  body: "## {{date}}\n- [ ] ",
  isDailyDefault: false,
  createdAt: "2026-09-30T00:00:00.000Z",
  updatedAt: "2026-09-30T00:00:00.000Z",
};

describe("validateTemplateDraft", () => {
  test("requires a name after trimming and applies the server's limits", () => {
    expect(validateTemplateDraft(EMPTY_TEMPLATE_DRAFT)).toEqual({ name: "required" });
    expect(validateTemplateDraft({ ...EMPTY_TEMPLATE_DRAFT, name: "   " })).toEqual({ name: "required" });
    expect(validateTemplateDraft({ ...EMPTY_TEMPLATE_DRAFT, name: ` ${"a".repeat(TEMPLATE_NAME_MAX)} ` })).toEqual({});
    expect(validateTemplateDraft({ ...EMPTY_TEMPLATE_DRAFT, name: "a".repeat(TEMPLATE_NAME_MAX + 1) })).toEqual({ name: "tooLong" });
    expect(validateTemplateDraft({ name: "ok", body: "x".repeat(TEMPLATE_BODY_MAX + 1), isDailyDefault: false })).toEqual({ body: "tooLong" });
  });

  test("hasDraftErrors reflects any field error", () => {
    expect(hasDraftErrors({})).toBe(false);
    expect(hasDraftErrors({ body: "tooLong" })).toBe(true);
  });
});

describe("request bodies", () => {
  test("create trims the name and keeps the body verbatim", () => {
    expect(templateCreateBody({ name: "  Daily ", body: "  {{date}}  ", isDailyDefault: true })).toEqual({
      name: "Daily",
      body: "  {{date}}  ",
      isDailyDefault: true,
    });
  });

  test("patch lists only changed fields, and nothing for an untouched draft", () => {
    const draft = draftFromTemplate(template);
    expect(templatePatch(template, draft)).toEqual({});
    expect(templatePatch(template, { ...draft, name: " Meeting " })).toEqual({});
    expect(templatePatch(template, { ...draft, name: "Standup", isDailyDefault: true })).toEqual({ name: "Standup", isDailyDefault: true });
    expect(templatePatch(template, { ...draft, body: "" })).toEqual({ body: "" });
  });
});

describe("templateErrorField", () => {
  test("puts a name conflict beside the name field and everything else on the form", () => {
    expect(templateErrorField(new ApiClientError(409, "conflict", "taken"))).toBe("name");
    expect(templateErrorField(new ApiClientError(400, "validation", "bad"))).toBe("form");
    expect(templateErrorField(new TypeError("offline"))).toBe("form");
  });
});

describe("templatePreview", () => {
  test("shows the first non-blank line", () => {
    expect(templatePreview("\n\r\n  ## Agenda  \n- [ ] a")).toBe("## Agenda");
    expect(templatePreview("")).toBe("");
    expect(templatePreview(" \n\t")).toBe("");
  });
});
