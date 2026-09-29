"use client";

import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { ApiFormatSchema } from "@/lib/ai-provider-options";
import { chatAuthModels } from "@/lib/ai-model-catalog";
import { FieldError, SecretInput } from "./AiFieldControls";
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
  readonly error?: string;
}) {
  const id = `${idPrefix}-chat-model`;
  const describedBy = error ? `${id}-error` : `${id}-hint`;
  const catalog = chat.mode === "auth" ? chatAuthModels(chat.provider) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">사용할 모델</label>
      {catalog ? (
        <AuthModelSelect
          id={id}
          value={chat.model}
          catalog={catalog}
          savedModel={savedAuthModel}
          error={error}
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
      <FieldError id={`${id}-error`} message={error} />
      {!error ? (
        <p id={`${id}-hint`} className="text-pretty text-sm text-mute">
          {catalog
            ? "최신 모델부터 보여요. 계정이나 요금제에 따라 쓸 수 없는 모델도 있어요."
            : "모델 ID를 직접 입력하세요. 구독 Auth와 유료 API의 모델 권한은 서로 달라요."}
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
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${idPrefix}-chat-format`} className="text-sm font-medium">API 형식</label>
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
  return (
    <>
      {custom ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-chat-base-url`} className="text-sm font-medium">API 기본 URL</label>
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
            <FieldError id={`${idPrefix}-chat-base-url-error`} message={errors["chat.baseUrl"]} />
            <p id={`${idPrefix}-chat-base-url-hint`} className="text-sm text-mute">
              API 접두 주소 또는 선택한 API 형식에 맞는 전체 요청 주소를 입력하세요. Docker의 localhost는 컨테이너 자신이며, 호스트 서비스는 host.docker.internal 또는 접근 가능한 내부망 주소를 사용해요.
            </p>
          </div>
          <label className="flex min-h-touch cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chat.keyless}
              onChange={(event) => setChatAction({ keyless: event.target.checked, apiKey: "" })}
              className="size-4 accent-accent"
            />
            키 없이 동작하는 로컬 엔드포인트
          </label>
        </>
      ) : null}
      {!chat.keyless ? (
        <SecretInput
          id={`${idPrefix}-chat-key`}
          label="API 키"
          value={chat.apiKey}
          disabled={disabled}
          onChangeAction={(apiKey) => setChatAction({ apiKey })}
          error={errors["chat.apiKey"]}
          hint={
            retained
              ? "저장된 키가 있어요. 제공자와 기본 주소를 바꾸지 않았다면 비워 두세요."
              : chat.provider === "github-copilot"
                ? "일반 GitHub PAT가 아니라 Copilot API용 토큰을 입력하세요. 구독 Auth와는 별개이며 저장 뒤에는 다시 표시되지 않아요."
                : "유료 API 키는 구독 Auth와 별개예요. 저장 뒤에는 다시 표시되지 않아요."
          }
        />
      ) : null}
      {(custom || chat.provider === "github-copilot") ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <ChatApiFormatField idPrefix={idPrefix} chat={chat} setChatAction={setChatAction} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-chat-max-tokens`} className="text-sm font-medium">최대 출력 토큰 (선택)</label>
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
            <FieldError id={`${idPrefix}-chat-max-tokens-error`} message={errors["chat.maxOutputTokens"]} />
          </div>
        </div>
      ) : null}
      {custom ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-chat-headers`} className="text-sm font-medium">추가 헤더 JSON (선택)</label>
          <select
            aria-label="추가 헤더 처리"
            value={chat.headerAction}
            onChange={(event) => setChatAction({ headerAction: headerAction(event.target.value), headersJson: "" })}
            className={cn(inputClassName, "pr-8")}
          >
            <option value="retain">기존 헤더 유지</option>
            <option value="replace">새 헤더로 교체</option>
            <option value="clear">기존 헤더 삭제</option>
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
          <FieldError id={`${idPrefix}-chat-headers-error`} message={errors["chat.headers"]} />
          <p className="text-sm text-mute">저장된 헤더 값은 다시 표시되지 않아요. 목적지를 바꾸면 이전 헤더는 자동으로 버려져요.</p>
        </div>
      ) : null}
    </>
  );
}
