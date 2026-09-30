import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { db, query } from "@/server/db";
import { getOrCreateDaily } from "@/server/notes/service";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import {
  createTemplate, defaultDailyTemplateBody, deleteTemplate, listTemplates, updateTemplate,
} from "./service";

connectTestDatabase();
beforeEach(async () => {
  await resetData();
  await query("DELETE FROM note_templates");
});
afterAll(closeDb);

describe("template service", () => {
  test("lists templates by case-insensitive name", async () => {
    await createTemplate({ name: "회의록", body: "# {{title}}" });
    await createTemplate({ name: "beta" });
    await createTemplate({ name: "Alpha" });
    expect((await listTemplates()).map((template) => template.name)).toEqual(["Alpha", "beta", "회의록"]);
  });

  test("rejects a duplicate name on create and rename", async () => {
    const first = await createTemplate({ name: "Weekly" });
    const second = await createTemplate({ name: "Monthly" });
    await expect(createTemplate({ name: "Weekly" })).rejects.toMatchObject({ code: "conflict" });
    await expect(updateTemplate(second.id, { name: first.name })).rejects.toMatchObject({ code: "conflict" });
  });

  test("moves the daily default to the newly marked template", async () => {
    await createTemplate({ name: "Daily A", body: "A", isDailyDefault: true });
    const second = await createTemplate({ name: "Daily B", body: "B" });
    await updateTemplate(second.id, { isDailyDefault: true });
    const defaults = (await listTemplates()).filter((template) => template.isDailyDefault).map((template) => template.id);
    expect(defaults).toEqual([second.id]);
    expect(await defaultDailyTemplateBody(await db())).toBe("B");
  });

  test("keeps one default when two templates are marked concurrently", async () => {
    const a = await createTemplate({ name: "A" });
    const b = await createTemplate({ name: "B" });
    await Promise.all([updateTemplate(a.id, { isDailyDefault: true }), updateTemplate(b.id, { isDailyDefault: true })]);
    expect((await listTemplates()).filter((template) => template.isDailyDefault)).toHaveLength(1);
  });

  test("returns no default body after the default is unmarked or deleted", async () => {
    const template = await createTemplate({ name: "Daily", body: "x", isDailyDefault: true });
    await updateTemplate(template.id, { isDailyDefault: false });
    expect(await defaultDailyTemplateBody(await db())).toBeNull();
    await updateTemplate(template.id, { isDailyDefault: true });
    await deleteTemplate(template.id);
    expect(await defaultDailyTemplateBody(await db())).toBeNull();
  });

  test("reports missing templates and malformed ids", async () => {
    await expect(updateTemplate(crypto.randomUUID(), { name: "x" })).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteTemplate(crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteTemplate("not-a-uuid")).rejects.toMatchObject({ code: "validation" });
  });

  test("renders the default template into a new daily note", async () => {
    await createTemplate({ name: "Daily", body: "# {{title}}\n- [ ] 계획 {{date}} {{mood}}", isDailyDefault: true });
    const note = await getOrCreateDaily("2026-09-30");
    expect(note.body).toBe("# 2026-09-30\n- [ ] 계획 2026-09-30 {{mood}}");
  });
});
