"use client";

import { AI_PROVIDERS, AiProviderSchema } from "@/lib/ai-settings";
import type { WebAuthProvider } from "@/lib/ai-auth";
import { isCustomProvider } from "@/lib/ai-providers";
import { chatAuthModels } from "@/lib/ai-model-catalog";
import { useCopy } from "@/components/i18n";
import { Badge } from "@/components/ui/Badge";
import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { AI_COPY } from "./ai-copy";
import { AiAuthPanel, abandonAuthAttempt } from "./AiAuthPanel";
import { ConsentRow, FieldError, useFieldErrorText } from "./AiFieldControls";
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
  const { common, chat: copy } = useCopy(AI_COPY);
  const errorText = useFieldErrorText();
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
      <legend className="px-1 text-md font-semibold">{copy.legend}</legend>
      <p className="text-sm leading-relaxed text-mute">
        {copy.lead}
      </p>
      {saved?.chatManagedByEnvironment ? (
        <p className="mt-2 rounded-ctl bg-warn-soft px-3 py-2 text-sm text-warn">
          {copy.environment}
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
          {copy.enable}
        </label>
      ) : null}
      {chat.enabled ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-chat-name`} className="text-sm font-medium">{common.nameLabel}</label>
            <input
              id={`${idPrefix}-chat-name`}
              value={chat.name}
              maxLength={80}
              placeholder={copy.namePlaceholder}
              onChange={(event) => setChat({ name: event.target.value })}
              aria-invalid={errors["chat.name"] ? true : undefined}
              aria-describedby={errors["chat.name"] ? `${idPrefix}-chat-name-error` : `${idPrefix}-chat-name-hint`}
              className={inputClassName}
            />
            <FieldError id={`${idPrefix}-chat-name-error`} message={errorText(errors["chat.name"])} />
            {!errors["chat.name"] ? (
              <p id={`${idPrefix}-chat-name-hint`} className="text-sm text-mute">
                {allowDisable ? common.nameHintOptional : common.nameHintRequired}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-chat-provider`} className="text-sm font-medium">{copy.provider}</label>
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
              <FieldError id={`${idPrefix}-chat-provider-error`} message={errorText(errors["chat.provider"])} />
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">{common.modeLegend}</legend>
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
                  {common.modeApi}
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
                    {copy.modeAuth}
                  </label>
                ) : <p className="text-sm text-mute">{copy.apiKeyOnly}</p>}
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
                    {copy.legacyCli}
                  </p>
                  {status ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={status.available ? "ok" : "warn"}>{status.available ? copy.cliReady : copy.cliMissing}</Badge>
                      <p className="text-pretty text-mute">{status.available ? copy.cliReadyDetail : copy.cliMissingDetail}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {webAuthProvider === "github-copilot" ? (
                <ChatApiFormatField idPrefix={idPrefix} chat={chat} setChatAction={setChat} />
              ) : null}
              {webAuthProvider === "github-copilot" ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${idPrefix}-chat-domain`} className="text-sm font-medium">{copy.enterpriseDomain}</label>
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
                  <FieldError id={`${idPrefix}-chat-domain-error`} message={errorText(errors["chat.enterpriseDomain"])} />
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
              <FieldError id={`${idPrefix}-chat-auth-error`} message={errorText(errors["chat.auth"])} />
            </>
          ) : null}
          <ConsentRow
            id={`${idPrefix}-chat-consent`}
            checked={chat.consent}
            disabled={disabled}
            onChangeAction={(consent) => setChat({ consent })}
            error={errorText(errors["chat.consent"])}
          >
            {copy.consent}
          </ConsentRow>
        </div>
      ) : null}
    </fieldset>
  );
}
