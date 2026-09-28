import { describe, expect, test } from "bun:test";
import { buildCapturePayload, EMPTY_DRAFT, isDraftEmpty, isHttpUrl } from "./capture-form";

describe("isHttpUrl", () => {
  test("accepts absolute http(s) addresses only", () => {
    expect(isHttpUrl("https://example.com/a?b=1")).toBe(true);
    expect(isHttpUrl("  http://예시.kr  ")).toBe(true);
    expect(isHttpUrl("example.com")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("https://example.com and more")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});

describe("buildCapturePayload", () => {
  test("rejects an empty draft on the text field", () => {
    const result = buildCapturePayload({ text: "  ", url: "", title: "" });
    expect(result).toEqual({ ok: false, field: "text", message: expect.any(String) });
  });

  test("rejects a malformed url without discarding the text", () => {
    const result = buildCapturePayload({ text: "메모", url: "not a url", title: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("url");
  });

  test("sends trimmed text and omits empty optional fields", () => {
    expect(buildCapturePayload({ text: "  한 줄 메모  ", url: "", title: "" })).toEqual({ ok: true, payload: { text: "한 줄 메모" } });
  });

  test("promotes a text field that is only a URL into the url field", () => {
    expect(buildCapturePayload({ text: "https://example.com/post", url: "", title: "" })).toEqual({
      ok: true,
      payload: { url: "https://example.com/post" },
    });
  });

  test("keeps text and url separate when both are present, with an optional title", () => {
    expect(buildCapturePayload({ text: "읽을 것", url: " https://example.com ", title: " 제목 " })).toEqual({
      ok: true,
      payload: { text: "읽을 것", url: "https://example.com", title: "제목" },
    });
  });
});

describe("isDraftEmpty", () => {
  test("ignores whitespace-only fields", () => {
    expect(isDraftEmpty(EMPTY_DRAFT)).toBe(true);
    expect(isDraftEmpty({ text: " \n", url: "", title: "" })).toBe(true);
    expect(isDraftEmpty({ text: "", url: "", title: "x" })).toBe(false);
  });
});
