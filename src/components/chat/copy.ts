export const CHAT_COPY = {
  title: "AI 채팅",
  empty: "무엇이든 물어보세요",
  emptyHint: "근거 노트가 없어요",
  send: "보내기",
  citations: "출처",
  noCitations: "출처 없음",
  approve: "노트에 반영",
  cancel: "취소",
  contextLimit: "노트 10개/32k 한도예요",
  answerFail: "답변을 못 받았어요",
  jevError: "관련성 판단을 못 했어요",
  jevErrorRetry: "관련성 판단을 못 했어요. 잠시 뒤 다시",
  lowConfidence: "확신 낮음 · 직접 고르세요",
  promoteToast: "wiki에 저장됨",
  scopeCurrent: "현재",
  scopeSelected: "선택",
  scopeAll: "전체",
  scopeEvidence: "근거",
  model: "Codex",
  newThread: "새 대화",
  promote: "새 노트로",
  undo: "실행취소",
  retry: "다시",
  composerLabel: "질문",
  routeLead: "이 요청",
  routeChat: "채팅",
  routeEdit: "노트 수정",
  on: "ON",
  approveFail: "노트에 반영하지 못했어요",
  threadsLabel: "스레드",
} as const;

export function promoteToastMessage(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  if (!trimmed) return CHAT_COPY.promoteToast;
  return `wiki/${trimmed}에 저장됨`;
}

export function evidenceChipLabel(count: number): string {
  return `${CHAT_COPY.scopeEvidence}(${count})`;
}
