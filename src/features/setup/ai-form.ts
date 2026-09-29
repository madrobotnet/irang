import {
  type AiProvider,
  type AiSettingsInput,
  type AiSettingsView,
} from "@/lib/ai-settings";
import { ApiClientError } from "@/lib/api-client";
import {
  buildChatConnection,
  buildJevConnection,
  chatFormFromView,
  emptyChatForm,
  emptyJevForm,
  jevFormFromView,
  type ChatFormState,
  type ConnectionErrors,
  type ConnectionFieldKey,
  type JevFormState,
} from "./connection-form";

export {
  chatProviderInfo,
  jevProviderInfo,
  providerSupportsAuth,
  type ChatFormState,
  type JevFormState,
} from "./connection-form";

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

export type AiFormState = { chat: ChatFormState; jev: JevFormState };

/** Redacted saved settings from GET /api/settings/ai; null during first-run setup. */
export type SavedAiView = AiSettingsView | null;

export function emptyAiForm(): AiFormState {
  return { chat: emptyChatForm(), jev: emptyJevForm() };
}

/** Initialize the editor from redacted saved metadata; keys start blank (presence only). */
export function aiFormFromView(view: SavedAiView): AiFormState {
  const base = emptyAiForm();
  if (!view) return base;
  return {
    chat: view.chat ? chatFormFromView(view.chat) : base.chat,
    jev: view.jev ? jevFormFromView(view.jev) : base.jev,
  };
}

export type AiFieldKey = `${"chat" | "jev"}.${ConnectionFieldKey}`;

export type AiFormErrors = Partial<Record<AiFieldKey, string>>;

const CONNECTION_ERROR_KEYS = [
  "name",
  "provider",
  "model",
  "apiKey",
  "baseUrl",
  "headers",
  "maxOutputTokens",
  "enterpriseDomain",
  "auth",
  "consent",
] as const satisfies readonly ConnectionFieldKey[];

export function mergeConnectionErrors(
  target: AiFormErrors,
  purpose: "chat" | "jev",
  source: ConnectionErrors,
): void {
  for (const key of CONNECTION_ERROR_KEYS) {
    const message = source[key];
    if (message) target[`${purpose}.${key}`] = message;
  }
}

export type AiBuildResult = { ok: true; input: AiSettingsInput } | { ok: false; errors: AiFormErrors };

/**
 * Build the shared AiSettingsInput. A blank key on an unchanged provider is
 * omitted so the server retains the saved key; a new provider requires a key.
 */
export function buildAiInput(state: AiFormState, saved: SavedAiView): AiBuildResult {
  const errors: AiFormErrors = {};
  let chat: AiSettingsInput["chat"] = null;
  if (state.chat.enabled) {
    const built = buildChatConnection(state.chat, saved?.chat ?? null);
    if (built.ok) {
      chat = built.connection;
    } else {
      mergeConnectionErrors(errors, "chat", built.errors);
    }
  }
  let jev: AiSettingsInput["jev"] = null;
  if (state.jev.enabled) {
    const built = buildJevConnection(state.jev, saved?.jev ?? null);
    if (built.ok) {
      jev = built.connection;
    } else {
      mergeConnectionErrors(errors, "jev", built.errors);
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      chat,
      chatConsent: state.chat.enabled ? state.chat.consent : false,
      jev,
      jevConsent: state.jev.enabled ? state.jev.consent : false,
      ...(state.chat.enabled && state.chat.name.trim() ? { chatName: state.chat.name.trim() } : {}),
      ...(state.jev.enabled && state.jev.name.trim() ? { jevName: state.jev.name.trim() } : {}),
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
