import { describe, expect, test } from "bun:test";
import {
  inboxUrlStatus, replacePendingInboxUrlStatus, stripInboxUrlStatus,
  URL_FAILED_MARKER, URL_PENDING_MARKER,
} from "./inbox-url-status";

describe("inbox URL status", () => {
  test("recognises stable and legacy markers", () => {
    expect(inboxUrlStatus(`memo\n\n${URL_PENDING_MARKER}`)).toBe("pending");
    expect(inboxUrlStatus(URL_FAILED_MARKER)).toBe("failed");
    expect(inboxUrlStatus("> URL 내용을 가져오는 중입니다.")).toBe("pending");
    expect(inboxUrlStatus("> URL 내용을 가져오지 못했습니다. 원문 링크는 보존되었습니다.")).toBe("failed");
    expect(inboxUrlStatus("URL 내용을 가져오는 중입니다.")).toBeNull();
  });

  test("strips status and replaces old or new pending markers", () => {
    expect(stripInboxUrlStatus(`memo\n\n${URL_FAILED_MARKER}`)).toBe("memo");
    expect(stripInboxUrlStatus("memo\n\n> URL 내용을 가져오지 못했습니다. 원문 링크는 보존되었습니다.")).toBe("memo");
    expect(replacePendingInboxUrlStatus(`memo\n\n${URL_PENDING_MARKER}`, "page text")).toBe("memo\n\npage text");
    expect(replacePendingInboxUrlStatus("memo\n\n> URL 내용을 가져오는 중입니다.", URL_FAILED_MARKER))
      .toBe(`memo\n\n${URL_FAILED_MARKER}`);
  });
});
