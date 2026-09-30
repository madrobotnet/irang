import { defineCopy } from "@/lib/i18n/copy";

/** Quick-capture dialog copy. `invalid` is keyed by CaptureInvalidReason from capture-form. */
export const CAPTURE_COPY = defineCopy({
  ko: {
    title: "빠른 캡처",
    description: "지금 적어 두고, 분류는 나중에 인박스에서 하세요.",
    textLabel: "내용",
    textPlaceholder: "떠오른 생각, 할 일, 인용할 문장을 적어 보세요. URL만 붙여 넣어도 돼요.",
    urlLabel: "원문 URL (선택)",
    titleLabel: "제목 (선택)",
    titlePlaceholder: "비워 두면 내용을 보고 자동으로 정해요.",
    clear: "입력 지우기",
    confirmClear: "작성 중인 캡처를 지울까요? 되돌릴 수 없어요.",
    close: "닫기",
    save: "인박스에 저장",
    saved: "인박스에 저장했어요.",
    savedKeptDraft: "인박스에 저장했어요. 그사이 새로 입력한 내용은 그대로 있어요.",
    saveFailed: "저장하지 못했어요. 입력한 내용은 그대로 남아 있어요.",
    invalid: {
      empty: "텍스트나 URL을 입력하세요.",
      badUrl: "http:// 또는 https://로 시작하는 주소만 저장할 수 있어요.",
    },
  },
  en: {
    title: "Quick capture",
    description: "Write it down now. Sort it in your inbox later.",
    textLabel: "Content",
    textPlaceholder: "Jot down a thought, a to-do or a quote. You can also paste a URL on its own.",
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
      badUrl: "You can only save addresses that start with http:// or https://.",
    },
  },
});
