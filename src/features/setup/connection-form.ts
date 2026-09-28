import type { ChatInput, JevInput } from "@/lib/ai-connections";
import {
  AI_PROVIDERS,
  JEV_PROVIDERS,
  type AiProvider,
  type ChatConnectionView,
  type JevConnectionView,
  type JevProvider,
} from "@/lib/ai-settings";
import {
  BaseUrlSchema,
  ExtraHeadersSchema,
  ModelSchema,
} from "@/lib/ai-provider-options";
import { isCustomProvider } from "@/lib/ai-providers";
import type {
  BuildConnectionResult,
  ChatFormState,
  ConnectionErrors,
  JevFormState,
} from "./connection-form-types";

export type {
  BuildConnectionResult,
  ChatFormState,
  ConnectionErrors,
  ConnectionFieldKey,
  HeaderAction,
  JevFormState,
} from "./connection-form-types";

export const chatProviderInfo = (provider: AiProvider) =>
  AI_PROVIDERS.find((entry) => entry.id === provider) ?? AI_PROVIDERS[0];

export const jevProviderInfo = (provider: JevProvider) =>
  JEV_PROVIDERS.find((entry) => entry.id === provider) ?? JEV_PROVIDERS[0];

export const providerSupportsAuth = (provider: AiProvider): boolean =>
  chatProviderInfo(provider).supportsAuth;

function isAuthProvider(
  provider: AiProvider,
): provider is "openai" | "google" | "github-copilot" | "openrouter" | "xai" {
  return provider === "openai"
    || provider === "google"
    || provider === "github-copilot"
    || provider === "openrouter"
    || provider === "xai";
}

export function emptyChatForm(): ChatFormState {
  return {
    enabled: false,
    name: "",
    mode: "api",
    provider: "openai",
    model: chatProviderInfo("openai").model,
    apiKey: "",
    keyless: false,
    baseUrl: "",
    apiFormat: "chat-completions",
    headersJson: "",
    headerAction: "retain",
    maxOutputTokens: "",
    enterpriseDomain: "",
    consent: false,
  };
}

export function emptyJevForm(): JevFormState {
  return {
    enabled: false,
    name: "",
    mode: "api",
    provider: "typesafe",
    model: jevProviderInfo("typesafe").model,
    apiKey: "",
    consent: false,
  };
}

export function chatFormFromView(view: ChatConnectionView, name = ""): ChatFormState {
  return {
    ...emptyChatForm(),
    enabled: true,
    name,
    mode: view.mode,
    provider: view.provider,
    model: view.model,
    keyless: view.mode === "api" && isCustomProvider(view.provider) && !view.hasApiKey,
    baseUrl: view.baseUrl ?? "",
    apiFormat: view.apiFormat ?? (view.provider === "github-copilot" ? "responses"
      : view.provider === "anthropic-compatible" ? "anthropic-messages" : "chat-completions"),
    maxOutputTokens: view.maxOutputTokens?.toString() ?? "",
    enterpriseDomain: view.enterpriseDomain ?? "",
    consent: true,
  };
}

export function jevFormFromView(view: JevConnectionView, name = ""): JevFormState {
  return {
    ...emptyJevForm(),
    enabled: true,
    name,
    mode: view.mode ?? "api",
    provider: view.provider,
    model: view.model,
    consent: true,
  };
}

function parseModel(model: string, errors: ConnectionErrors): string | null {
  const result = ModelSchema.safeParse(model);
  if (!result.success) {
    errors.model = "영문, 숫자와 . _ : @ ~ / - 만 사용한 모델 ID를 입력해 주세요.";
    return null;
  }
  return result.data;
}

function parseHeaders(value: string, errors: ConnectionErrors): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    errors.headers = "헤더를 JSON 객체로 입력해 주세요.";
    return null;
  }
  const result = ExtraHeadersSchema.safeParse(parsed);
  if (!result.success) {
    errors.headers = result.error.issues[0]?.message ?? "헤더 이름과 값을 확인해 주세요.";
    return null;
  }
  return result.data;
}

export function buildChatConnection(
  state: ChatFormState,
  saved: ChatConnectionView | null,
): BuildConnectionResult<ChatInput> {
  const errors: ConnectionErrors = {};
  const model = parseModel(state.model, errors);
  if (!state.consent) errors.consent = "질문과 관련 노트를 선택한 제공자에게 보내는 데 동의해 주세요.";
  if (state.mode === "auth") {
    const enterpriseDomain = state.enterpriseDomain.trim();
    const unchanged = saved?.mode === "auth"
      && saved.provider === state.provider
      && (saved.enterpriseDomain ?? "") === enterpriseDomain;
    const webAuth = state.provider === "github-copilot" || state.provider === "openrouter" || state.provider === "xai";
    if (!isAuthProvider(state.provider)) errors.provider = "이 제공자는 API 키 연결만 지원해요.";
    if (webAuth && !state.authAttemptId && !(unchanged && saved?.hasCredential)) {
      errors.auth = "브라우저 로그인을 완료해 주세요.";
    }
    if (Object.keys(errors).length > 0 || !model || !isAuthProvider(state.provider)) return { ok: false, errors };
    return {
      ok: true,
      connection: {
        mode: "auth",
        provider: state.provider,
        model,
        ...(state.provider === "github-copilot" && state.apiFormat ? { apiFormat: state.apiFormat } : {}),
        ...(state.provider === "github-copilot" && enterpriseDomain ? { enterpriseDomain } : {}),
        ...(state.authAttemptId ? { authAttemptId: state.authAttemptId } : {}),
      },
    };
  }

  const custom = isCustomProvider(state.provider);
  const baseResult = custom ? BaseUrlSchema.safeParse(state.baseUrl) : null;
  if (custom && !baseResult?.success) {
    errors.baseUrl = baseResult?.error.issues[0]?.message ?? "API 기본 URL을 입력해 주세요.";
  }
  const baseUrl = baseResult?.success ? baseResult.data : undefined;
  const unchanged = saved?.mode === "api"
    && saved.provider === state.provider
    && (saved.baseUrl ?? "") === (baseUrl ?? "");
  const apiKey = state.apiKey.trim();
  if (!apiKey && !state.keyless && !(unchanged && saved?.hasApiKey)) {
    errors.apiKey = custom
      ? "API 키를 입력하거나 키 없이 연결을 선택해 주세요."
      : "선택한 제공자의 API 키를 입력해 주세요.";
  }
  let headers: Record<string, string> | undefined;
  if (custom && state.headerAction === "clear") headers = {};
  if (custom && state.headerAction === "replace") {
    const parsed = parseHeaders(state.headersJson, errors);
    if (parsed) headers = parsed;
  }
  const maxText = state.maxOutputTokens.trim();
  const maxOutputTokens = maxText ? Number(maxText) : undefined;
  if (maxOutputTokens !== undefined && (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 128_000)) {
    errors.maxOutputTokens = "1부터 128000 사이의 정수를 입력해 주세요.";
  }
  if (Object.keys(errors).length > 0 || !model) return { ok: false, errors };
  return {
    ok: true,
    connection: {
      mode: "api",
      provider: state.provider,
      model,
      ...(apiKey ? { apiKey } : state.keyless && custom ? { apiKey: "" } : {}),
      ...(baseUrl ? { baseUrl } : {}),
      ...(custom || state.provider === "github-copilot" ? { apiFormat: state.apiFormat } : {}),
      ...(headers !== undefined ? { headers } : {}),
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    },
  };
}

export function buildJevConnection(
  state: JevFormState,
  saved: JevConnectionView | null,
): BuildConnectionResult<JevInput> {
  const errors: ConnectionErrors = {};
  const model = parseModel(state.model, errors);
  if (!state.consent) errors.consent = "캡처 내용과 최근 노트 정보를 선택한 Jev 제공자에게 보내는 데 동의해 주세요.";
  if (state.mode === "auth") {
    const unchanged = saved?.mode === "auth" && saved.provider === "openrouter";
    if (state.provider !== "openrouter") errors.provider = "TypeSafe는 API 키 연결만 지원해요.";
    if (!state.authAttemptId && !(unchanged && saved?.hasCredential)) errors.auth = "OpenRouter 로그인을 완료해 주세요.";
    if (Object.keys(errors).length > 0 || !model) return { ok: false, errors };
    return {
      ok: true,
      connection: {
        mode: "auth",
        provider: "openrouter",
        model,
        ...(state.authAttemptId ? { authAttemptId: state.authAttemptId } : {}),
      },
    };
  }
  const apiKey = state.apiKey.trim();
  const retained = saved?.provider === state.provider && (saved.mode ?? "api") === "api" && saved.hasApiKey;
  if (!apiKey && !retained) errors.apiKey = "선택한 Jev 제공자의 API 키를 입력해 주세요.";
  if (Object.keys(errors).length > 0 || !model) return { ok: false, errors };
  return {
    ok: true,
    connection: {
      mode: "api",
      provider: state.provider,
      model,
      ...(apiKey ? { apiKey } : {}),
    },
  };
}
