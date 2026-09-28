import {
  AI_PROVIDERS,
  JEV_PROVIDERS,
  type AiProvider,
  type AiSettingsInput,
  type AiSettingsView,
  type JevProvider,
} from "@/lib/ai-settings";
import { ApiClientError } from "@/lib/api-client";

/** Server-reported auth (CLI) readiness; credentials are never part of this shape. */
export type AiConnectionStatus = {
  provider: AiProvider;
  available: boolean;
  instructions: string;
  detail: string;
};

/** GET/PUT /api/settings/ai response contract (route owned by the server side). */
export type AiSettingsResponse = {
  settings: AiSettingsView;
  connections: AiConnectionStatus[];
};

export type ChatFormState = {
  enabled: boolean;
  mode: "api" | "auth";
  provider: AiProvider;
  model: string;
  /** Component memory only: never persisted to storage, URLs, or logs. */
  apiKey: string;
  consent: boolean;
};

export type JevFormState = {
  enabled: boolean;
  provider: JevProvider;
  model: string;
  apiKey: string;
  consent: boolean;
};

export type AiFormState = { chat: ChatFormState; jev: JevFormState };

/** Redacted saved settings from GET /api/settings/ai; null during first-run setup. */
export type SavedAiView = AiSettingsView | null;

export const chatProviderInfo = (provider: AiProvider) =>
  AI_PROVIDERS.find((entry) => entry.id === provider) ?? AI_PROVIDERS[0];

export const jevProviderInfo = (provider: JevProvider) =>
  JEV_PROVIDERS.find((entry) => entry.id === provider) ?? JEV_PROVIDERS[0];

export const providerSupportsAuth = (provider: AiProvider): boolean => chatProviderInfo(provider).supportsAuth;

export function emptyAiForm(): AiFormState {
  return {
    chat: { enabled: false, mode: "api", provider: "openai", model: chatProviderInfo("openai").model, apiKey: "", consent: false },
    jev: { enabled: false, provider: "typesafe", model: jevProviderInfo("typesafe").model, apiKey: "", consent: false },
  };
}

/** Initialize the editor from redacted saved metadata; keys start blank (presence only). */
export function aiFormFromView(view: SavedAiView): AiFormState {
  const base = emptyAiForm();
  if (!view) return base;
  return {
    chat: view.chat
      ? { enabled: true, mode: view.chat.mode, provider: view.chat.provider, model: view.chat.model, apiKey: "", consent: true }
      : base.chat,
    jev: view.jev
      ? { enabled: true, provider: view.jev.provider, model: view.jev.model, apiKey: "", consent: true }
      : base.jev,
  };
}

export type AiFieldKey =
  | "chat.provider"
  | "chat.model"
  | "chat.apiKey"
  | "chat.consent"
  | "jev.model"
  | "jev.apiKey"
  | "jev.consent";

export type AiFormErrors = Partial<Record<AiFieldKey, string>>;

export type AiBuildResult = { ok: true; input: AiSettingsInput } | { ok: false; errors: AiFormErrors };

/**
 * Build the shared AiSettingsInput. A blank key on an unchanged provider is
 * omitted so the server retains the saved key; a new provider requires a key.
 */
export function buildAiInput(state: AiFormState, saved: SavedAiView): AiBuildResult {
  const errors: AiFormErrors = {};
  let chat: AiSettingsInput["chat"] = null;
  if (state.chat.enabled) {
    const model = state.chat.model.trim();
    if (!model) errors["chat.model"] = "모델 ID를 입력해 주세요.";
    if (!state.chat.consent) errors["chat.consent"] = "선택한 AI 제공자에게 질문과 관련 노트를 보내는 데 동의해 주세요.";
    if (state.chat.mode === "auth") {
      if (state.chat.provider !== "openai" && state.chat.provider !== "google") {
        errors["chat.provider"] = "이 제공자는 API 키 연결만 지원해요.";
      } else if (model) {
        chat = { mode: "auth", provider: state.chat.provider, model };
      }
    } else {
      const apiKey = state.chat.apiKey.trim();
      const retained = saved?.chat?.mode === "api" && saved.chat.provider === state.chat.provider && saved.chat.hasApiKey;
      if (!apiKey && !retained) errors["chat.apiKey"] = "선택한 제공자의 API 키를 입력해 주세요.";
      else if (model) chat = { mode: "api", provider: state.chat.provider, model, ...(apiKey ? { apiKey } : {}) };
    }
  }
  let jev: AiSettingsInput["jev"] = null;
  if (state.jev.enabled) {
    const model = state.jev.model.trim();
    if (!model) errors["jev.model"] = "모델 ID를 입력해 주세요.";
    if (!state.jev.consent) errors["jev.consent"] = "선택한 Jev 제공자에게 캡처 내용과 최근 노트 제목을 보내는 데 동의해 주세요.";
    const apiKey = state.jev.apiKey.trim();
    const retained = saved?.jev?.provider === state.jev.provider && saved.jev.hasApiKey;
    if (!apiKey && !retained) errors["jev.apiKey"] = "선택한 Jev 제공자의 API 키를 입력해 주세요.";
    else if (model) jev = { provider: state.jev.provider, model, ...(apiKey ? { apiKey } : {}) };
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      chat,
      chatConsent: state.chat.enabled ? state.chat.consent : false,
      jev,
      jevConsent: state.jev.enabled ? state.jev.consent : false,
    },
  };
}

export type SetupSecretErrors = Partial<Record<"setupToken" | "password" | "passwordConfirmation", string>>;

export function validateSetupSecrets(input: { setupToken: string; password: string; passwordConfirmation: string }): SetupSecretErrors {
  const errors: SetupSecretErrors = {};
  if (input.setupToken.trim().length < 32) errors.setupToken = "설치자가 받은 32자 이상의 확인 코드를 입력해 주세요.";
  if (input.password.length < 12) errors.password = "비밀번호는 12자 이상으로 정해 주세요.";
  else if (input.password.length > 512) errors.password = "비밀번호는 512자를 넘을 수 없어요.";
  if (input.passwordConfirmation !== input.password) errors.passwordConfirmation = "비밀번호가 일치하지 않습니다.";
  return errors;
}

export type SetupFailureGroup = "token" | "password" | "ai" | "form";
export type SetupFailure = { group: SetupFailureGroup; message: string };

/** Map a POST /api/setup failure to the fieldset that owns it. */
export function setupFailure(error: unknown): SetupFailure {
  if (error instanceof ApiClientError) {
    if (error.status === 403) return { group: "token", message: error.message };
    if (error.status === 409) return { group: "form", message: error.message };
    if (error.status === 503) return { group: "form", message: error.message };
    if (error.status === 400) return { group: "form", message: error.message };
    return { group: "form", message: "설정을 저장하지 못했습니다. 다시 시도해 주세요." };
  }
  if (error instanceof TypeError) return { group: "form", message: "서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요." };
  return { group: "form", message: "설정을 저장하지 못했습니다. 다시 시도해 주세요." };
}

/** Map a PUT /api/settings/ai failure to a plain message; input stays editable. */
export function aiSaveFailureMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 400 || error.status === 409 || error.status === 503) return error.message;
    return "AI 설정을 저장하지 못했습니다. 다시 시도해 주세요.";
  }
  if (error instanceof TypeError) return "서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.";
  return "AI 설정을 저장하지 못했습니다. 다시 시도해 주세요.";
}

/** Official server-side login commands; the app never accepts OAuth tokens or provider passwords. */
export const AUTH_LOGIN_COMMANDS: Readonly<Record<"openai" | "google", string>> = {
  openai: "docker compose exec app codex login --device-auth",
  google: "docker compose exec -e NO_BROWSER=true app gemini",
};
