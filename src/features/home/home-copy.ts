import { defineCopy } from "@/lib/i18n/copy";

/**
 * Home dashboard copy. Count phrases take the raw count (for plurals) and a `value`
 * slot where the dashboard renders the styled number, so word order can differ per locale.
 */
export const HOME_COPY = defineCopy({
  ko: {
    title: "홈",
    headline: {
      inbox: (count: number) => `정리할 캡처가 ${count}개 있어요`,
      firstNote: "첫 생각을 캡처해 볼까요?",
      startDaily: "오늘 노트를 시작해 볼까요?",
      clear: "인박스를 모두 정리했어요",
    },
    counts: {
      notes: (_count: number, value: string) => `노트 ${value}개`,
      links: (_count: number, value: string) => `연결 ${value}개`,
      tags: (_count: number, value: string) => `태그 ${value}개`,
    },
    capture: "빠르게 캡처",
    newNote: "새 노트",
    createFailed: "노트를 만들지 못했어요.",
    loadError: {
      title: "홈 정보를 불러오지 못했어요.",
      help: "네트워크 연결을 확인한 뒤 다시 시도하세요.",
      retry: "다시 불러오기",
    },
    loading: "홈 정보를 불러오는 중",
    asideLabel: "고정한 노트와 다시 볼 노트",
    firstRun: {
      title: "아직 노트도 캡처도 없어요",
      description: "떠오른 생각은 캡처해 두고 나중에 정리하세요. 바로 쓰고 싶다면 새 노트를 만드세요.",
    },
    folded: {
      title: "고정한 노트와 다시 볼 노트가 여기에 모여요",
      description: "자주 여는 노트를 고정하거나 2주 넘게 두면 이곳에 나타나요.",
    },
    inbox: {
      title: "인박스",
      reviewAll: (count: number) => `${count}개 모두 정리하기`,
      review: "정리하기",
      untitled: "제목 없는 캡처",
    },
    today: {
      title: "오늘 노트",
      emptyExcerpt: "아직 아무것도 적지 않았어요.",
      prompt: "오늘 한 일과 떠오른 생각을 한곳에 모아 두세요.",
      continue: "이어 쓰기",
      create: "오늘 노트 만들기",
    },
    recent: {
      title: "최근 수정한 노트",
      all: "전체 노트",
      allPinnedTitle: "최근 노트는 모두 고정한 노트예요",
      allPinnedDescription: "고정한 노트 목록에서 바로 열 수 있어요.",
      noneTitle: "아직 노트가 없어요",
      noneDescription: "새 노트를 만들거나 인박스의 캡처를 노트로 옮겨 보세요.",
    },
    moreTags: (count: number) => `외 ${count}개`,
    pinned: {
      title: "고정한 노트",
    },
    resurface: {
      title: "다시 볼 노트",
      description: "2주 넘게 손대지 않은 노트 가운데 오늘 고른 노트예요.",
    },
    time: {
      justNow: "방금",
      yesterday: "어제",
    },
  },
  en: {
    title: "Home",
    headline: {
      inbox: (count) => (count === 1 ? "You have 1 capture to review" : `You have ${count} captures to review`),
      firstNote: "Ready to capture your first thought?",
      startDaily: "Ready to start today's note?",
      clear: "Your inbox is all clear",
    },
    counts: {
      notes: (count, value) => `${value} ${count === 1 ? "note" : "notes"}`,
      links: (count, value) => `${value} ${count === 1 ? "link" : "links"}`,
      tags: (count, value) => `${value} ${count === 1 ? "tag" : "tags"}`,
    },
    capture: "Quick capture",
    newNote: "New note",
    createFailed: "Couldn't create the note.",
    loadError: {
      title: "Couldn't load your home page.",
      help: "Check your network connection and try again.",
      retry: "Try again",
    },
    loading: "Loading your home page",
    asideLabel: "Pinned notes and notes to revisit",
    firstRun: {
      title: "No notes or captures yet",
      description: "Capture thoughts now and sort them out later, or create a note to start writing right away.",
    },
    folded: {
      title: "Pinned notes and notes to revisit collect here",
      description: "Pin notes you open often, or leave notes for two weeks, and they'll show up here.",
    },
    inbox: {
      title: "Inbox",
      reviewAll: (count) => `Review all ${count}`,
      review: "Review",
      untitled: "Untitled capture",
    },
    today: {
      title: "Today's note",
      emptyExcerpt: "Nothing written yet.",
      prompt: "Keep what you did today and what came to mind in one place.",
      continue: "Keep writing",
      create: "Create today's note",
    },
    recent: {
      title: "Recently edited",
      all: "All notes",
      allPinnedTitle: "Your recent notes are all pinned",
      allPinnedDescription: "Open them straight from your pinned notes.",
      noneTitle: "No notes yet",
      noneDescription: "Create a note, or turn a capture from your inbox into one.",
    },
    moreTags: (count) => `+${count} more`,
    pinned: {
      title: "Pinned notes",
    },
    resurface: {
      title: "Notes to revisit",
      description: "Picked today from notes you haven't touched in over two weeks.",
    },
    time: {
      justNow: "just now",
      yesterday: "yesterday",
    },
  },
});
