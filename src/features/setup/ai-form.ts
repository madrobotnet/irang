import {
  type AiProvider,
  type AiSettingsInput,
  type AiSettingsView,
} from "@/lib/ai-settings";
import { ApiClientError } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import type { Locale } from "@/lib/i18n/locale";
import { AI_COPY, type ConnectionErrorKey } from "./ai-copy";
import { SETUP_COPY, type SetupSecretErrorKey } from "./setup-copy";
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

/**
 * Server-reported auth (CLI) readiness; credentials are never part of this shape.
 * `instructions` and `detail` are server text and are not rendered; the UI words the status from `available`.
 */
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

/** Field -> validation reason. Rendered through AI_COPY so an error follows a language switch. */
export type AiFormErrors = Partial<Record<AiFieldKey, ConnectionErrorKey>>;

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
    const reason = source[key];
    if (reason) target[`${purpose}.${key}`] = reason;
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

export type SetupSecretErrors = Partial<Record<"setupToken" | "password" | "passwordConfirmation", SetupSecretErrorKey>>;

export function validateSetupSecrets(input: { setupToken: string; password: string; passwordConfirmation: string }): SetupSecretErrors {
  const errors: SetupSecretErrors = {};
  if (input.setupToken.trim().length < 32) errors.setupToken = "setupTokenShort";
  if (input.password.length < 12) errors.password = "passwordShort";
  else if (input.password.length > 512) errors.password = "passwordLong";
  if (input.passwordConfirmation !== input.password) errors.passwordConfirmation = "passwordMismatch";
  return errors;
}

export type SetupFailureGroup = "token" | "password" | "ai" | "form";
/** The retained failure itself; its text is chosen at render time in the current language. */
export type SetupFailure = { readonly group: SetupFailureGroup; readonly cause: unknown };

/** Map a POST /api/setup failure to the fieldset that owns it. */
export function setupFailure(error: unknown): SetupFailure {
  return { group: error instanceof ApiClientError && error.status === 403 ? "token" : "form", cause: error };
}

/** Server-explained statuses show the server's localized message; others keep a local fallback. */
const EXPLAINED_STATUSES: ReadonlySet<number> = new Set([400, 409, 503]);

export function setupFailureText(failure: SetupFailure, locale: Locale): string {
  const copy = SETUP_COPY[locale].failure;
  const error = failure.cause;
  if (error instanceof ApiClientError) {
    if (error.status === 403) return localizedApiError(error, locale, copy.token);
    return EXPLAINED_STATUSES.has(error.status) ? localizedApiError(error, locale, copy.save) : copy.save;
  }
  return error instanceof TypeError ? copy.network : copy.save;
}

/** Text for a PUT/POST/DELETE /api/settings/ai failure; the form input stays editable. */
export function aiSaveFailureText(error: unknown, locale: Locale): string {
  const copy = AI_COPY[locale].save;
  if (error instanceof ApiClientError) {
    return EXPLAINED_STATUSES.has(error.status) ? localizedApiError(error, locale, copy.failed) : copy.failed;
  }
  return error instanceof TypeError ? copy.network : copy.failed;
}
