export const LOGIN_COPY = {
  title: "Second Brain",
  cta: "들어가기",
  empty: "비밀번호를 입력해 주세요",
  badPassword: "비밀번호가 맞지 않아요",
  network: "연결에 실패했어요 · 다시",
  misconfigured: "운영 설정이 없습니다. 환경 변수를 확인하세요.",
  passwordLabel: "비밀번호",
} as const;

export function lockedMessage(mm: string, ss: string): string {
  return `너무 많이 시도했어요. ${mm}:${ss} 뒤에 다시 해보세요.`;
}
