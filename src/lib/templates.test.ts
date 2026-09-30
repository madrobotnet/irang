import { describe, expect, test } from "bun:test";
import { renderTemplate } from "./templates";

describe("renderTemplate", () => {
  test("replaces every date and title placeholder, including spaced ones", () => {
    const body = "# {{title}}\n날짜: {{date}} / {{ date }}";
    expect(renderTemplate(body, { date: "2026-09-30", title: "회의" })).toBe("# 회의\n날짜: 2026-09-30 / 2026-09-30");
  });

  test("keeps unknown placeholders and replacement-pattern characters literal", () => {
    const body = "{{time}} {{title}} {{Date}}";
    expect(renderTemplate(body, { date: "2026-09-30", title: "$& $1 cost" })).toBe("{{time}} $& $1 cost {{Date}}");
  });
});
