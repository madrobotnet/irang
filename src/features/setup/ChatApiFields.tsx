"use client";

import { useCopy } from "@/components/i18n";
import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { ApiFormatSchema } from "@/lib/ai-provider-options";
import { chatAuthModels } from "@/lib/ai-model-catalog";
import { AI_COPY, type ConnectionErrorKey } from "./ai-copy";
import { FieldError, SecretInput, useFieldErrorText } from "./AiFieldControls";
import { AuthModelSelect } from "./AuthModelSelect";
import type { AiFormErrors } from "./ai-form";
import type { ChatFormState, HeaderAction } from "./connection-form";

function headerAction(value: string): HeaderAction {
  if (value === "replace" || value === "clear") return value;
  return "retain";
}

export function ChatModelField({ idPrefix, chat, savedAuthModel, setChatAction, error }: {
  readonly idPrefix: string;
  readonly chat: ChatFormState;
  readonly savedAuthModel: string | null;
  readonly setChatAction: (patch: Partial<ChatFormState>) => void;
  readonly error?: ConnectionErrorKey;
}) {
  const copy = useCopy(AI_COPY).chat;
  const errorText = useFieldErrorText();
  const id = `${idPrefix}-chat-model`;
  const describedBy = error ? `${id}-error` : `${id}-hint`;
  const catalog = chat.mode === "auth" ? chatAuthModels(chat.provider) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{copy.model}</label>
      {catalog ? (
        <AuthModelSelect
          id={id}
          value={chat.model}
          catalog={catalog}
          savedModel={savedAuthModel}
          invalid={Boolean(error)}
          describedBy={describedBy}
          onChangeAction={(model) => setChatAction({ model })}
        />
      ) : (
        <input
          id={id}
          value={chat.model}
          onChange={(event) => setChatAction({ model: event.target.value })}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          className={inputClassName}
        />
      )}
      <FieldError id={`${id}-error`} message={errorText(error)} />
      {!error ? (
        <p id={`${id}-hint`} className="text-pretty text-sm text-mute">
          {catalog ? copy.modelHintAuth : copy.modelHintApi}
        </p>
      ) : null}
    </div>
  );
}

export function ChatApiFormatField({ idPrefix, chat, setChatAction }: {
  readonly idPrefix: string;
  readonly chat: ChatFormState;
  readonly setChatAction: (patch: Partial<ChatFormState>) => void;
}) {
  const copy = useCopy(AI_COPY).chat;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${idPrefix}-chat-format`} className="text-sm font-medium">{copy.apiFormat}</label>
      <select
        id={`${idPrefix}-chat-format`}
        value={chat.apiFormat}
        onChange={(event) => setChatAction({ apiFormat: ApiFormatSchema.parse(event.target.value) })}
        className={cn(inputClassName, "pr-8")}
      >
        {chat.provider !== "anthropic-compatible" ? (
          <>
            <option value="chat-completions">OpenAI Chat Completions</option>
            <option value="responses">OpenAI Responses</option>
          </>
        ) : null}
        {chat.provider !== "openai-compatible" ? <option value="anthropic-messages">Anthropic Messages</option> : null}
      </select>
    </div>
  );
}

export function ChatApiFields({ idPrefix, chat, setChatAction, retained, custom, errors, disabled }: {
  readonly idPrefix: string;
  readonly chat: ChatFormState;
  readonly setChatAction: (patch: Partial<ChatFormState>) => void;
  readonly retained: boolean;
  readonly custom: boolean;
  readonly errors: AiFormErrors;
  readonly disabled: boolean;
}) {
  const copy = useCopy(AI_COPY).chat;
  const errorText = useFieldErrorText();
  return (
    <>
      {custom ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-chat-base-url`} className="text-sm font-medium">{copy.baseUrl}</label>
            <input
              id={`${idPrefix}-chat-base-url`}
              type="url"
              value={chat.baseUrl}
              placeholder="http://host.docker.internal:11434/v1"
              onChange={(event) => setChatAction({ baseUrl: event.target.value, consent: false })}
              aria-invalid={errors["chat.baseUrl"] ? true : undefined}
              aria-describedby={
                errors["chat.baseUrl"]
                  ? `${idPrefix}-chat-base-url-error ${idPrefix}-chat-base-url-hint`
                  : `${idPrefix}-chat-base-url-hint`
              }
              className={inputClassName}
            />
            <FieldError id={`${idPrefix}-chat-base-url-error`} message={errorText(errors["chat.baseUrl"])} />
            <p id={`${idPrefix}-chat-base-url-hint`} className="text-sm text-mute">
              {copy.baseUrlHint}
            </p>
          </div>
          <label className="flex min-h-touch cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chat.keyless}
              onChange={(event) => setChatAction({ keyless: event.target.checked, apiKey: "" })}
              className="size-4 accent-accent"
            />
            {copy.keyless}
          </label>
        </>
      ) : null}
      {!chat.keyless ? (
        <SecretInput
          id={`${idPrefix}-chat-key`}
          label={copy.apiKey}
          value={chat.apiKey}
          disabled={disabled}
          onChangeAction={(apiKey) => setChatAction({ apiKey })}
          error={errorText(errors["chat.apiKey"])}
          hint={
            retained
              ? copy.apiKeyRetained
              : chat.provider === "github-copilot"
                ? copy.apiKeyCopilot
                : copy.apiKeyHint
          }
        />
      ) : null}
      {(custom || chat.provider === "github-copilot") ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <ChatApiFormatField idPrefix={idPrefix} chat={chat} setChatAction={setChatAction} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-chat-max-tokens`} className="text-sm font-medium">{copy.maxOutputTokens}</label>
            <input
              id={`${idPrefix}-chat-max-tokens`}
              type="number"
              min={1}
              max={128000}
              inputMode="numeric"
              value={chat.maxOutputTokens}
              onChange={(event) => setChatAction({ maxOutputTokens: event.target.value })}
              aria-invalid={errors["chat.maxOutputTokens"] ? true : undefined}
              aria-describedby={errors["chat.maxOutputTokens"] ? `${idPrefix}-chat-max-tokens-error` : undefined}
              className={inputClassName}
            />
            <FieldError id={`${idPrefix}-chat-max-tokens-error`} message={errorText(errors["chat.maxOutputTokens"])} />
          </div>
        </div>
      ) : null}
      {custom ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-chat-headers`} className="text-sm font-medium">{copy.headers}</label>
          <select
            aria-label={copy.headerAction}
            value={chat.headerAction}
            onChange={(event) => setChatAction({ headerAction: headerAction(event.target.value), headersJson: "" })}
            className={cn(inputClassName, "pr-8")}
          >
            <option value="retain">{copy.headerRetain}</option>
            <option value="replace">{copy.headerReplace}</option>
            <option value="clear">{copy.headerClear}</option>
          </select>
          {chat.headerAction === "replace" ? (
            <textarea
              id={`${idPrefix}-chat-headers`}
              rows={4}
              value={chat.headersJson}
              placeholder={'{"x-api-version":"2026-01"}'}
              onChange={(event) => setChatAction({ headersJson: event.target.value })}
              aria-invalid={errors["chat.headers"] ? true : undefined}
              aria-describedby={errors["chat.headers"] ? `${idPrefix}-chat-headers-error` : undefined}
              className={cn(inputClassName, "h-auto py-2 font-mono text-sm")}
            />
          ) : null}
          <FieldError id={`${idPrefix}-chat-headers-error`} message={errorText(errors["chat.headers"])} />
          <p className="text-sm text-mute">{copy.headersNote}</p>
        </div>
      ) : null}
    </>
  );
}
