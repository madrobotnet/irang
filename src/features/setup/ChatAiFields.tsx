"use client";

import { AI_PROVIDERS, AiProviderSchema } from "@/lib/ai-settings";
import { Badge } from "@/components/ui/Badge";
import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { ConsentRow, FieldError, SecretInput } from "./AiFieldControls";
import {
  AUTH_LOGIN_COMMANDS, chatProviderInfo,
  type AiConnectionStatus, type AiFormErrors, type ChatFormState, type SavedAiView,
} from "./ai-form";

export function ChatAiFields({ value: chat, onChange, disabled, saved, connections, errors, idPrefix }: {
  readonly value: ChatFormState;
  readonly onChange: (next: ChatFormState) => void;
  readonly disabled: boolean;
  readonly saved: SavedAiView;
  readonly connections?: readonly AiConnectionStatus[];
  readonly errors: AiFormErrors;
  readonly idPrefix: string;
}) {
  const info = chatProviderInfo(chat.provider);
  const retained = saved?.chat?.mode === "api" && saved.chat.provider === chat.provider && saved.chat.hasApiKey;
  const setChat = (patch: Partial<ChatFormState>) => onChange({ ...chat, ...patch });
  const authProvider = chat.provider === "openai" || chat.provider === "google" ? chat.provider : null;
  const status = connections?.find((entry) => entry.provider === chat.provider);

  return (
    <fieldset className="rounded-card border border-line p-4 sm:p-5" disabled={disabled}>
      <legend className="px-1 text-md font-semibold">노트 채팅 AI</legend>
      <p className="text-sm leading-relaxed text-mute">
        질문과 최근 대화 기록, 관련 노트 일부가 선택한 제공자에게 전송돼요. 켜지 않아도 노트, 캡처, 검색과 그래프는 그대로 사용할 수 있어요.
      </p>
      {saved?.chatManagedByEnvironment ? (
        <p className="mt-2 rounded-ctl bg-warn-soft px-3 py-2 text-sm text-warn">
          지금은 서버의 기존 Codex 연결을 사용 중이에요. 여기서 저장하면 새 설정이 적용되고, 끄고 저장하면 채팅 AI가 꺼져요.
        </p>
      ) : null}
      <label htmlFor={`${idPrefix}-chat-enabled`} className="mt-3 flex min-h-touch cursor-pointer items-center gap-2.5 text-md font-medium">
        <input id={`${idPrefix}-chat-enabled`} type="checkbox" checked={chat.enabled}
          onChange={(event) => setChat({ enabled: event.target.checked })} className="size-4 shrink-0 accent-accent" />
        노트 채팅에 AI 사용
      </label>
      {chat.enabled ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-chat-provider`} className="text-sm font-medium">제공자</label>
              <select
                id={`${idPrefix}-chat-provider`} value={chat.provider}
                onChange={(event) => {
                  const provider = AiProviderSchema.parse(event.target.value);
                  const next = chatProviderInfo(provider);
                  setChat({ provider, model: next.model, apiKey: "", mode: next.supportsAuth ? chat.mode : "api", consent: false });
                }}
                aria-invalid={errors["chat.provider"] ? true : undefined}
                aria-describedby={errors["chat.provider"] ? `${idPrefix}-chat-provider-error` : undefined}
                className={cn(inputClassName, "pr-8")}
              >
                {AI_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
              <FieldError id={`${idPrefix}-chat-provider-error`} message={errors["chat.provider"]} />
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">연결 방식</legend>
              <div className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1">
                <label className="flex min-h-touch cursor-pointer items-center gap-2 text-md">
                  <input type="radio" name={`${idPrefix}-chat-mode`} value="api" checked={chat.mode === "api"}
                    onChange={() => setChat({ mode: "api" })} className="size-4 accent-accent" />
                  API 키
                </label>
                {info.supportsAuth ? (
                  <label className="flex min-h-touch cursor-pointer items-center gap-2 text-md">
                    <input type="radio" name={`${idPrefix}-chat-mode`} value="auth" checked={chat.mode === "auth"}
                      onChange={() => setChat({ mode: "auth", apiKey: "" })} className="size-4 accent-accent" />
                    서버 로그인 (Auth)
                  </label>
                ) : <p className="text-sm text-mute">Claude는 API 키 연결만 지원해요.</p>}
              </div>
            </fieldset>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-chat-model`} className="text-sm font-medium">사용할 모델</label>
            <input id={`${idPrefix}-chat-model`} list={`${idPrefix}-chat-models`} value={chat.model}
              onChange={(event) => setChat({ model: event.target.value })}
              aria-invalid={errors["chat.model"] ? true : undefined}
              aria-describedby={errors["chat.model"] ? `${idPrefix}-chat-model-error` : `${idPrefix}-chat-model-hint`}
              autoComplete="off" spellCheck={false} className={inputClassName} />
            <datalist id={`${idPrefix}-chat-models`}><option value={info.model} /></datalist>
            {errors["chat.model"] ? <FieldError id={`${idPrefix}-chat-model-error`} message={errors["chat.model"]} /> : (
              <p id={`${idPrefix}-chat-model-hint`} className="text-sm text-mute">
                기본 모델을 고르거나 계정에서 사용할 수 있는 모델 ID를 입력하세요. 구독과 API의 모델 권한은 다를 수 있어요.
              </p>
            )}
          </div>
          {chat.mode === "api" ? (
            <SecretInput id={`${idPrefix}-chat-key`} label="API 키" value={chat.apiKey} disabled={disabled}
              onChange={(apiKey) => setChat({ apiKey })} error={errors["chat.apiKey"]}
              hint={retained ? "저장된 키가 있어요. 바꾸지 않으려면 비워 두세요." : "키는 이 서버에 저장되며, 저장 뒤에는 화면에 다시 표시되지 않아요."} />
          ) : authProvider ? (
            <div className="rounded-ctl border border-line bg-desk px-3 py-3 text-sm">
              <p>앱에 제공자 비밀번호나 OAuth 토큰을 입력하지 않아요. 서버에서 공식 명령으로 로그인해 주세요.</p>
              <p className="mt-2"><code className="break-all rounded-ctl bg-card px-2 py-1 font-mono text-xs">{AUTH_LOGIN_COMMANDS[authProvider]}</code></p>
              {status ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={status.available ? "ok" : "warn"}>{status.available ? "로그인 파일 확인됨" : "로그인 필요"}</Badge>
                  <p className="text-mute">{status.detail}</p>
                </div>
              ) : <p className="mt-2 text-mute">실제 계정 유효성과 모델 사용 권한은 첫 요청에서 확인돼요.</p>}
            </div>
          ) : null}
          <ConsentRow id={`${idPrefix}-chat-consent`} checked={chat.consent} disabled={disabled}
            onChange={(consent) => setChat({ consent })} error={errors["chat.consent"]}>
            질문, 최근 대화 기록, 관련 노트 일부를 선택한 제공자에게 보내는 데 동의합니다.
          </ConsentRow>
        </div>
      ) : null}
    </fieldset>
  );
}
