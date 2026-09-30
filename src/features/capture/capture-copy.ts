import { defineCopy } from "@/lib/i18n/copy";

/** Quick-capture dialog copy. `invalid` is keyed by CaptureInvalidReason from capture-form. */
export const CAPTURE_COPY = defineCopy({
  ko: {
    title: "빠른 캡처",
    description: "지금 적고, 분류는 인박스에서 나중에 하세요.",
    textLabel: "내용",
    textPlaceholder: "떠오른 생각, 할 일, 인용할 문장을 적어 보세요. URL만 붙여 넣어도 됩니다.",
    urlLabel: "원문 URL (선택)",
    titleLabel: "제목 (선택)",
    titlePlaceholder: "비워 두면 내용에서 자동으로 정합니다.",
    clear: "입력 지우기",
    confirmClear: "작성 중인 캡처를 지울까요? 이 작업은 되돌릴 수 없습니다.",
    close: "닫기",
    save: "인박스에 저장",
    saved: "인박스에 저장했습니다.",
    savedKeptDraft: "인박스에 저장했습니다. 새 입력은 그대로 두었습니다.",
    saveFailed: "저장하지 못했습니다. 입력은 그대로 보관했습니다.",
    invalid: {
      empty: "텍스트나 URL 중 하나는 있어야 합니다.",
      badUrl: "http:// 또는 https://로 시작하는 주소만 저장할 수 있습니다.",
    },
  },
  en: {
    title: "Quick capture",
    description: "Write it down now. Sort it in your inbox later.",
    textLabel: "Content",
    textPlaceholder: "Jot down a thought, a to-do or a quote. You can also paste just a URL.",
    urlLabel: "Source URL (optional)",
    titleLabel: "Title (optional)",
    titlePlaceholder: "Leave blank to take it from the content.",
    clear: "Clear",
    confirmClear: "Clear this capture? This can't be undone.",
    close: "Close",
    save: "Save to inbox",
    saved: "Saved to your inbox.",
    savedKeptDraft: "Saved to your inbox. What you typed since is still here.",
    saveFailed: "Couldn't save. Your input is still here.",
    invalid: {
      empty: "Add some text or a URL.",
      badUrl: "Only addresses starting with http:// or https:// can be saved.",
    },
  },
});
