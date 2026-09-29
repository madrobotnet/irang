"use client";

import { ExternalLink, LogIn, X } from "lucide-react";
import { useEffect, useId, useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import type { WebAuthProvider } from "@/lib/ai-auth";
import { FieldError } from "./AiFieldControls";
import { AuthAttemptController, awaitingAuthCode, isActiveAttempt } from "./auth-attempt";

export { abandonAuthAttempt } from "./auth-attempt";

const DEFAULT_INTRO = "제공자 페이지에서 로그인하고, 확인 코드가 표시되면 그 페이지에 입력하세요. 비밀번호와 발급된 토큰은 앱 입력창에 넣지 않아요.";
const PROVIDER_COPY: Record<WebAuthProvider, { readonly intro: string; readonly link: string }> = {
  "github-copilot": { intro: DEFAULT_INTRO, link: "로그인 페이지 열기" },
  openrouter: { intro: DEFAULT_INTRO, link: "로그인 페이지 열기" },
  xai: { intro: DEFAULT_INTRO, link: "로그인 페이지 열기" },
  openai: {
    intro: "ChatGPT 로그인 페이지를 열고, 아래 확인 코드를 그 페이지에 입력하세요. 이 앱에는 코드나 비밀번호를 입력하지 않아요.",
    link: "ChatGPT 로그인 페이지 열기",
  },
  google: {
    intro: "Google 로그인 페이지에서 권한을 허용하면 일회용 인증 코드가 표시돼요. 그 코드를 복사해 아래에 붙여 넣으세요. 비밀번호와 발급된 토큰은 앱에 입력하지 않아요.",
    link: "Google 로그인 페이지 열기",
  },
};

/** Google's one-time authorization code entry. Lives inside setup/settings forms, so it never submits them. */
export function AuthCodeField({
  id,
  value,
  error,
  submitting,
  disabled,
  onChangeAction,
  onSubmitAction,
}: {
  readonly id: string;
  readonly value: string;
  readonly error: string | null;
  readonly submitting: boolean;
  readonly disabled?: boolean;
  readonly onChangeAction: (code: string) => void;
  readonly onSubmitAction: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">Google 인증 코드</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="text"
          value={value}
          maxLength={4096}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          readOnly={submitting}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={(event) => onChangeAction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            // Implicit submission would send the surrounding setup or connection form instead.
            event.preventDefault();
            onSubmitAction();
          }}
          className={cn(inputClassName, "h-11 font-mono")}
        />
        <Button size="lg" loading={submitting} disabled={disabled} onClick={() => onSubmitAction()}>
          {submitting ? "코드 확인 중…" : "인증 코드 제출"}
        </Button>
      </div>
      {error ? <FieldError id={`${id}-error`} message={error} /> : (
        <p id={`${id}-hint`} className="text-pretty text-sm text-mute">
          한 번만 쓸 수 있는 코드예요. 주소(URL) 전체가 아니라 코드만 붙여 넣어 주세요.
        </p>
      )}
    </div>
  );
}

export function AiAuthPanel({
  provider,
  enterpriseDomain,
  setupToken,
  disabled,
  readyAttemptId,
  hasSavedCredential = false,
  onReadyAction,
}: {
  readonly provider: WebAuthProvider;
  readonly enterpriseDomain?: string;
  readonly setupToken?: string;
  readonly disabled?: boolean;
  readonly readyAttemptId?: string;
  readonly hasSavedCredential?: boolean;
  readonly onReadyAction: (attemptId?: string) => void;
}) {
  const controller = useMemo(
    () => new AuthAttemptController({ provider, enterpriseDomain, setupToken }),
    [provider, enterpriseDomain, setupToken],
  );
  useEffect(() => controller.setReadyHandler(onReadyAction), [controller, onReadyAction]);
  // Scope change, unmount or a hidden Activity abandons the unfinished attempt and ignores its late replies.
  useEffect(() => () => controller.release(), [controller]);
  const { attempt, starting, submitting, code, codeError, error } =
    useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const codeId = useId();
  const copy = PROVIDER_COPY[provider];
  const active = isActiveAttempt(attempt);
  const awaitingCode = awaitingAuthCode(attempt);
  const waiting = awaitingCode
    ? "Google 인증 코드를 기다리는 중이에요."
    : attempt?.status === "pending" && attempt.requiresCode === false
      ? "인증 코드를 확인하는 중이에요."
      : "로그인 완료를 기다리는 중이에요.";

  return (
    <div className="rounded-ctl border border-line bg-desk px-3 py-3 text-sm">
      <p className="text-pretty">{copy.intro}</p>
      {provider === "openrouter" ? (
        <p className="mt-2 text-mute">OpenRouter Auth는 API 키를 발급하는 방식이며 OpenRouter 사용 요금이 적용돼요. 다른 서비스의 구독 이용권을 가져오지 않아요.</p>
      ) : null}
      {attempt?.verificationUrl ? (
        <a
          href={attempt.verificationUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-touch items-center gap-2 text-accent underline focus-ring"
        >
          {copy.link}
          <ExternalLink aria-hidden className="size-4" />
        </a>
      ) : null}
      {attempt?.userCode ? (
        <p className="mt-2">
          확인 코드: <code className="select-all rounded-ctl border border-line bg-card px-2 py-0.5 font-mono text-md font-semibold tracking-wider">{attempt.userCode}</code>
        </p>
      ) : null}
      {provider === "openai" && attempt && attempt.status !== "ready" ? (
        <p className="mt-2 text-pretty text-mute">
          코드 입력이 막히거나 거부되면 ChatGPT 설정의 보안에서 Codex 기기 코드 로그인을 켜 주세요. 워크스페이스 계정은 관리자가 허용해야 해요.
        </p>
      ) : null}
      {attempt?.status === "ready" || readyAttemptId ? (
        <p role="status" className="mt-2 text-ok">로그인을 확인했어요. 이제 연결을 저장하세요.</p>
      ) : hasSavedCredential ? (
        <p className="mt-2 text-mute">
          {provider === "github-copilot"
            ? "저장된 로그인이 있어요. 제공자와 기업 도메인을 바꾸지 않으면 그대로 유지돼요."
            : "저장된 로그인이 있어요. 제공자를 바꾸지 않으면 그대로 유지돼요."}
        </p>
      ) : active ? (
        <p role="status" className="mt-2 text-mute">{waiting}</p>
      ) : null}
      {awaitingCode ? (
        <AuthCodeField
          id={codeId}
          value={code}
          error={codeError}
          submitting={submitting}
          disabled={disabled}
          onChangeAction={controller.setCode}
          onSubmitAction={() => void controller.submitCode()}
        />
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="lg"
          loading={starting}
          disabled={disabled || active}
          leading={<LogIn aria-hidden className="size-4" />}
          onClick={() => void controller.start()}
        >
          {readyAttemptId ? "다시 로그인" : "로그인 시작"}
        </Button>
        {error && active ? (
          <Button size="lg" disabled={disabled || submitting} onClick={controller.retryStatus}>
            상태 다시 확인
          </Button>
        ) : null}
        {attempt ? (
          <Button size="lg" disabled={disabled} leading={<X aria-hidden className="size-4" />} onClick={() => void controller.cancel()}>
            로그인 취소
          </Button>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-danger">{error}</p> : null}
    </div>
  );
}
