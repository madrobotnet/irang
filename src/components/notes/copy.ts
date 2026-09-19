export const NOTE_COPY = {
  empty: "첫 노트를 만들거나 캡처하세요",
  save: "저장",
  trash: "휴지통으로",
  restore: "복구",
  trashBanner: (days: number) =>
    `휴지통에 있어요. ${days}일 안에 복구할 수 있어요.`,
  newNote: "새 노트",
  capture: "캡처",
  titlePlaceholder: "제목",
  bodyPlaceholder: "본문",
  loadError: "노트를 불러오지 못했어요",
  saveError: "저장에 실패했어요",
  retry: "다시",
  rawBadge: "읽기 전용",
} as const;
