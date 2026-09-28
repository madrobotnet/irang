/** Login screen copy (single owner, password only). */
export const LOGIN_COPY = {
  title: "세컨드 브레인",
  heading: "다시 시작하기",
  lead: "비밀번호를 입력하면 노트 작업대로 돌아갑니다.",
  passwordLabel: "비밀번호",
  passwordPlaceholder: "비밀번호",
  submit: "들어가기",
  submitting: "확인 중…",
  success: "확인되었습니다. 이동 중…",
  wrongPassword: "비밀번호가 맞지 않습니다. 다시 확인해 주세요.",
  unavailable: "로그인이 아직 설정되지 않았습니다. 서버의 AUTH_PASSWORD_HASH를 확인해 주세요.",
  network: "서버에 연결할 수 없습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.",
  unknown: "로그인을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  locked: (remaining: string) => `시도가 너무 많아 잠시 잠겼습니다. ${remaining} 후 다시 시도할 수 있습니다.`,
  lockedReady: "다시 시도할 수 있습니다.",
  showPassword: "비밀번호 표시",
  hidePassword: "비밀번호 숨기기",
  footnote: "한 사람만 쓰는 개인 작업 공간입니다. 비밀번호 하나로 어느 기기에서나 열 수 있습니다.",
} as const;

/** "1분 5초" / "45초" style remaining-time label. */
export function formatRemaining(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}초`;
  if (rest === 0) return `${minutes}분`;
  return `${minutes}분 ${rest}초`;
}
