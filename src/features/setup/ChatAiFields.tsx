"use client";

import { AI_PROVIDERS, AiProviderSchema } from "@/lib/ai-settings";
import type { WebAuthProvider } from "@/lib/ai-auth";
import { isCustomProvider } from "@/lib/ai-providers";
import { chatAuthModels } from "@/lib/ai-model-catalog";
import { Badge } from "@/components/ui/Badge";
import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { AiAuthPanel, abandonAuthAttempt } from "./AiAuthPanel";
import { ConsentRow, FieldError } from "./AiFieldControls";
import { ChatApiFields, ChatApiFormatField, ChatModelField } from "./ChatApiFields";
import { modelForMode, modelForProvider, savedModelFor } from "./model-choice";
import {
  chatProviderInfo,
  type AiConnectionStatus,
  type AiFormErrors,
  type ChatFormState,
  type SavedAiView,
} from "./ai-form";

function selectedWebAuthProvider(provider: ChatFormState["provider"]): WebAuthProvider | null {
  if (provider === "openai" || provider === "google" || provider === "github-copilot"
    || provider === "openrouter" || provider === "xai") return provider;
  return null;
}

export function ChatAiFields({
  value: chat,
  onChangeAction,
  disabled,
  saved,
  connections,
  errors,
  idPrefix,
  setupToken,
  allowDisable = true,
}: {
  readonly value: ChatFormState;
  readonly onChangeAction: (next: ChatFormState) => void;
  readonly disabled: boolean;
  readonly saved: SavedAiView;
  readonly connections?: readonly AiConnectionStatus[];
  readonly errors: AiFormErrors;
  readonly idPrefix: string;
  readonly setupToken?: string;
  readonly allowDisable?: boolean;
}) {
  const info = chatProviderInfo(chat.provider);
  const custom = isCustomProvider(chat.provider);
  const retained = saved?.chat?.mode === "api"
    && saved.chat.provider === chat.provider
    && (saved.chat.baseUrl ?? "") === chat.baseUrl.trim()
    && saved.chat.hasApiKey;
  const setChat = (patch: Partial<ChatFormState>) => onChangeAction({ ...chat, ...patch });
  const savedChat = saved?.chat ?? null;
  const switchMode = (mode: ChatFormState["mode"]) => modelForMode(chat, mode, savedChat, chatAuthModels(chat.provider));
  const webAuthProvider = selectedWebAuthProvider(chat.provider);
  const status = connections?.find((entry) => entry.provider === chat.provider);
  // Existing OpenAI/Google profiles may rely on the server's CLI login file instead of a stored credential.
  const legacyFileAuth = (chat.provider === "openai" || chat.provider === "google")
    && saved?.chat?.mode === "auth" && saved.chat.provider === chat.provider && !saved.chat.hasCredential;
  const abandonReadyAttempt = () => {
    if (!chat.authAttemptId) return;
    void abandonAuthAttempt(chat.authAttemptId, setupToken ? { setupToken } : {})
      .catch(() => console.warn("Provider login cleanup failed; the attempt will expire."));
  };

  return (
    <fieldset className="rounded-card border border-line p-4 sm:p-5" disabled={disabled}>
      <legend className="px-1 text-md font-semibold">노트 채팅 AI</legend>
      <p className="text-sm leading-relaxed text-mute">
        질문과 최근 대화 기록, 관련 노트 일부가 선택한 제공자에게 전송돼요. 켜지 않아도 노트, 캡처, 검색과 그래프는 그대로 사용할 수 있어요.
      </p>
      {saved?.chatManagedByEnvironment ? (
        <p className="mt-2 rounded-ctl bg-warn-soft px-3 py-2 text-sm text-warn">
          지금은 서버의 기존 Codex 연결을 사용 중이에요. 저장된 연결을 선택하거나 사용을 끄기 전까지 유지돼요.
        </p>
      ) : null}
      {allowDisable ? (
        <label htmlFor={`${idPrefix}-chat-enabled`} className="mt-3 flex min-h-touch cursor-pointer items-center gap-2.5 text-md font-medium">
          <input
            id={`${idPrefix}-chat-enabled`}
            type="checkbox"
            checked={chat.enabled}
            onChange={(event) => {
              if (!event.target.checked) abandonReadyAttempt();
              setChat({
                enabled: event.target.checked,
                ...(!event.target.checked ? { authAttemptId: undefined } : {}),
              });
            }}
            className="size-4 shrink-0 accent-accent"
          />
          노트 채팅에 AI 사용
        </label>
      ) : null}
      {chat.enabled ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-chat-name`} className="text-sm font-medium">연결 이름</label>
            <input
              id={`${idPrefix}-chat-name`}
              value={chat.name}
              maxLength={80}
              placeholder="예: 개인 OpenAI"
              onChange={(event) => setChat({ name: event.target.value })}
              aria-invalid={errors["chat.name"] ? true : undefined}
              aria-describedby={errors["chat.name"] ? `${idPrefix}-chat-name-error` : `${idPrefix}-chat-name-hint`}
              className={inputClassName}
            />
            <FieldError id={`${idPrefix}-chat-name-error`} message={errors["chat.name"]} />
            {!errors["chat.name"] ? (
              <p id={`${idPrefix}-chat-name-hint`} className="text-sm text-mute">
                {allowDisable ? "비워 두면 제공자 이름으로 저장해요." : "연결을 구분할 이름을 입력해 주세요."}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-chat-provider`} className="text-sm font-medium">제공자</label>
              <select
                id={`${idPrefix}-chat-provider`}
                value={chat.provider}
                onChange={(event) => {
                  abandonReadyAttempt();
                  const provider = AiProviderSchema.parse(event.target.value);
                  const next = chatProviderInfo(provider);
                  const mode = next.supportsAuth ? chat.mode : "api";
                  setChat({
                    provider,
                    model: modelForProvider({
                      provider, mode, saved: savedChat, catalog: chatAuthModels(provider), apiDefault: next.model,
                    }),
                    otherModeModel: undefined,
                    apiKey: "",
                    keyless: false,
                    baseUrl: "",
                    headersJson: "",
                    headerAction: "retain",
                    enterpriseDomain: "",
                    authAttemptId: undefined,
                    apiFormat: provider === "github-copilot" ? "responses"
                      : provider === "anthropic-compatible" ? "anthropic-messages" : "chat-completions",
                    mode,
                    consent: false,
                  });
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
                  <input
                    type="radio"
                    name={`${idPrefix}-chat-mode`}
                    value="api"
                    checked={chat.mode === "api"}
                    onChange={() => {
                      abandonReadyAttempt();
                      setChat({ mode: "api", authAttemptId: undefined, consent: false, ...switchMode("api") });
                    }}
                    className="size-4 accent-accent"
                  />
                  API 키
                </label>
                {info.supportsAuth ? (
                  <label className="flex min-h-touch cursor-pointer items-center gap-2 text-md">
                    <input
                      type="radio"
                      name={`${idPrefix}-chat-mode`}
                      value="auth"
                      checked={chat.mode === "auth"}
                      onChange={() => setChat({ mode: "auth", apiKey: "", keyless: false, consent: false, ...switchMode("auth") })}
                      className="size-4 accent-accent"
                    />
                    Auth
                  </label>
                ) : <p className="text-sm text-mute">이 제공자는 API 키 연결만 지원해요.</p>}
              </div>
            </fieldset>
          </div>
          <ChatModelField
            idPrefix={idPrefix}
            chat={chat}
            savedAuthModel={savedModelFor(savedChat, chat.provider, "auth")}
            setChatAction={setChat}
            error={errors["chat.model"]}
          />
          {chat.mode === "api" ? (
            <ChatApiFields idPrefix={idPrefix} chat={chat} setChatAction={setChat} retained={retained} custom={custom} errors={errors} disabled={disabled} />
          ) : webAuthProvider ? (
            <>
              {legacyFileAuth ? (
                <div className="flex flex-col gap-1.5 text-sm">
                  <p className="text-pretty text-mute">
                    서버의 기존 CLI 로그인을 계속 사용해요. 아래에서 다시 로그인하면 이 연결에 저장된 로그인으로 바뀌어요.
                  </p>
                  {status ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={status.available ? "ok" : "warn"}>{status.available ? "로그인 파일 확인됨" : "로그인 필요"}</Badge>
                      <p className="text-pretty text-mute">{status.detail}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {webAuthProvider === "github-copilot" ? (
                <ChatApiFormatField idPrefix={idPrefix} chat={chat} setChatAction={setChat} />
              ) : null}
              {webAuthProvider === "github-copilot" ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${idPrefix}-chat-domain`} className="text-sm font-medium">기업 도메인 (선택)</label>
                  <input
                    id={`${idPrefix}-chat-domain`}
                    value={chat.enterpriseDomain}
                    placeholder="github.example.com"
                    onChange={(event) => {
                      abandonReadyAttempt();
                      setChat({ enterpriseDomain: event.target.value, authAttemptId: undefined, consent: false });
                    }}
                    aria-invalid={errors["chat.enterpriseDomain"] ? true : undefined}
                    aria-describedby={errors["chat.enterpriseDomain"] ? `${idPrefix}-chat-domain-error` : undefined}
                    className={inputClassName}
                  />
                  <FieldError id={`${idPrefix}-chat-domain-error`} message={errors["chat.enterpriseDomain"]} />
                </div>
              ) : null}
              <AiAuthPanel
                key={`${webAuthProvider}:${chat.enterpriseDomain}`}
                provider={webAuthProvider}
                enterpriseDomain={chat.enterpriseDomain}
                setupToken={setupToken}
                disabled={disabled}
                readyAttemptId={chat.authAttemptId}
                hasSavedCredential={
                  saved?.chat?.mode === "auth"
                  && saved.chat.provider === webAuthProvider
                  && (saved.chat.enterpriseDomain ?? "") === chat.enterpriseDomain.trim()
                  && Boolean(saved.chat.hasCredential)
                }
                onReadyAction={(authAttemptId) => setChat({ authAttemptId })}
              />
              <FieldError id={`${idPrefix}-chat-auth-error`} message={errors["chat.auth"]} />
            </>
          ) : null}
          <ConsentRow
            id={`${idPrefix}-chat-consent`}
            checked={chat.consent}
            disabled={disabled}
            onChangeAction={(consent) => setChat({ consent })}
            error={errors["chat.consent"]}
          >
            질문, 최근 대화 기록, 관련 노트 일부를 선택한 제공자에게 보내는 데 동의합니다.
          </ConsentRow>
        </div>
      ) : null}
    </fieldset>
  );
}
