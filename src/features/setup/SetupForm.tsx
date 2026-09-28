"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { inputClassName } from "@/components/ui/Input";
import { api } from "@/lib/api-client";
import type { AiSettingsInput } from "@/lib/ai-settings";
import { AiFields } from "./AiFields";
import {
  buildAiInput,
  emptyAiForm,
  setupFailure,
  validateSetupSecrets,
  type AiFormErrors,
  type AiFormState,
  type SetupFailure,
  type SetupSecretErrors,
} from "./ai-form";

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; failure: SetupFailure }
  | { kind: "success" };

export function SetupForm() {
  const router = useRouter();
  const [setupToken, setSetupToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [ai, setAi] = useState<AiFormState>(() => emptyAiForm());
  const [secretErrors, setSecretErrors] = useState<SetupSecretErrors>({});
  const [aiErrors, setAiErrors] = useState<AiFormErrors>({});
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  const busy = state.kind === "submitting" || state.kind === "success";

  useEffect(() => {
    if (busy) return;
    const target = state.kind === "error"
      ? state.failure.group === "token" ? tokenRef.current : formErrorRef.current
      : formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
    target?.scrollIntoView({ block: "center" });
  }, [state, secretErrors, aiErrors, busy]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const secrets = validateSetupSecrets({ setupToken, password, passwordConfirmation });
    const built = buildAiInput(ai, null);
    setSecretErrors(secrets);
    setAiErrors(built.ok ? {} : built.errors);
    if (Object.keys(secrets).length > 0 || !built.ok) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "submitting" });
    try {
      await api<{ ok: boolean }>("/api/setup", {
        method: "POST",
        json: { setupToken: setupToken.trim(), password, passwordConfirmation, ai: built.input satisfies AiSettingsInput },
      });
      setState({ kind: "success" });
      router.push("/login?setup=complete");
    } catch (error) {
      // Recoverable: every field, including secrets, stays exactly as entered.
      const failure = setupFailure(error);
      setState({ kind: "error", failure });
    }
  }

  const formError = state.kind === "error" && state.failure.group !== "token" ? state.failure.message : null;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4" disabled={busy}>
        <legend className="mb-1 text-md font-semibold">설치 확인</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="setup-token" className="text-sm font-medium text-ink">
            설치 확인 코드
          </label>
          <div className="relative">
            <input
              ref={tokenRef}
              id="setup-token"
              name="setupToken"
              type={tokenVisible ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              required
              minLength={32}
              maxLength={256}
              value={setupToken}
              onChange={(event) => setSetupToken(event.target.value)}
              aria-invalid={secretErrors.setupToken || (state.kind === "error" && state.failure.group === "token") ? true : undefined}
              aria-describedby={
                secretErrors.setupToken
                  ? "setup-token-error"
                  : state.kind === "error" && state.failure.group === "token"
                    ? "setup-token-server-error"
                    : "setup-token-hint"
              }
              className={cn(inputClassName, "h-11 pr-12")}
            />
            <button
              type="button"
              aria-label={tokenVisible ? "확인 코드 숨기기" : "확인 코드 보기"}
              aria-pressed={tokenVisible}
              onClick={() => setTokenVisible((current) => !current)}
              className="absolute inset-y-0 right-0 my-auto flex size-11 items-center justify-center rounded-ctl text-mute hover:bg-line/60 hover:text-ink focus-ring sm:right-1 sm:size-9"
            >
              {tokenVisible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
          {secretErrors.setupToken ? (
            <p id="setup-token-error" role="alert" className="text-sm text-danger">
              {secretErrors.setupToken}
            </p>
          ) : state.kind === "error" && state.failure.group === "token" ? (
            <p id="setup-token-server-error" role="alert" className="text-sm text-danger">
              {state.failure.message}
            </p>
          ) : (
            <p id="setup-token-hint" className="text-sm text-mute">
              설치자가 서버에서 만든 32자 이상의 코드예요. 공유 링크나 주소창에 넣지 마세요.
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4" disabled={busy}>
        <legend className="mb-1 text-md font-semibold">로그인 비밀번호</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="setup-password" className="text-sm font-medium text-ink">
            새 비밀번호
          </label>
          <div className="relative">
            <input
              id="setup-password"
              name="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={512}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={secretErrors.password ? true : undefined}
              aria-describedby={secretErrors.password ? "setup-password-error" : "setup-password-hint"}
              className={cn(inputClassName, "h-11 pr-12")}
            />
            <button
              type="button"
              aria-label={passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((current) => !current)}
              className="absolute inset-y-0 right-0 my-auto flex size-11 items-center justify-center rounded-ctl text-mute hover:bg-line/60 hover:text-ink focus-ring sm:right-1 sm:size-9"
            >
              {passwordVisible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
          {secretErrors.password ? (
            <p id="setup-password-error" role="alert" className="text-sm text-danger">
              {secretErrors.password}
            </p>
          ) : (
            <p id="setup-password-hint" className="text-sm text-mute">
              12자 이상으로 정해 주세요. 이 비밀번호로 모든 기기에서 로그인해요.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="setup-password-confirm" className="text-sm font-medium text-ink">
            비밀번호 확인
          </label>
          <input
            id="setup-password-confirm"
            name="passwordConfirmation"
            type={passwordVisible ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={512}
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            aria-invalid={secretErrors.passwordConfirmation ? true : undefined}
            aria-describedby={secretErrors.passwordConfirmation ? "setup-password-confirm-error" : undefined}
            className={cn(inputClassName, "h-11")}
          />
          {secretErrors.passwordConfirmation ? (
            <p id="setup-password-confirm-error" role="alert" className="text-sm text-danger">
              {secretErrors.passwordConfirmation}
            </p>
          ) : null}
        </div>
      </fieldset>

      <div>
        <h3 className="mb-1 text-md font-semibold">AI 연결 (선택)</h3>
        <p className="mb-3 text-sm text-mute">기본은 꺼져 있어요. 지금 정하지 않아도 설정 화면에서 언제든 바꿀 수 있어요.</p>
        <AiFields idPrefix="setup-ai" value={ai} onChange={setAi} disabled={busy} errors={aiErrors} />
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" variant="primary" size="lg" loading={state.kind === "submitting"} disabled={busy} className="w-full sm:w-auto">
          {state.kind === "submitting" ? "설정 저장 중…" : "설정 완료하고 시작하기"}
        </Button>
        {formError ? (
          <p ref={formErrorRef} tabIndex={-1} role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}
        {state.kind === "success" ? (
          <p role="status" className="text-sm text-ok">
            설정을 저장했어요. 로그인 화면으로 이동합니다…
          </p>
        ) : null}
      </div>
    </form>
  );
}
