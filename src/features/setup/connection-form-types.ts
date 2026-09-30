import type { AiProvider, JevProvider } from "@/lib/ai-settings";
import type { ApiFormat } from "@/lib/ai-provider-options";
import type { ConnectionErrorKey } from "./ai-copy";

export type HeaderAction = "retain" | "replace" | "clear";

export type ChatFormState = {
  readonly enabled: boolean;
  readonly name: string;
  readonly mode: "api" | "auth";
  readonly provider: AiProvider;
  readonly model: string;
  /** Model last used in the other API/Auth mode during this edit; restored on switching back. */
  readonly otherModeModel?: string;
  readonly apiKey: string;
  readonly keyless: boolean;
  readonly baseUrl: string;
  readonly apiFormat: ApiFormat;
  readonly headersJson: string;
  readonly headerAction: HeaderAction;
  readonly maxOutputTokens: string;
  readonly enterpriseDomain: string;
  readonly authAttemptId?: string;
  readonly consent: boolean;
};

export type JevFormState = {
  readonly enabled: boolean;
  readonly name: string;
  readonly mode: "api" | "auth";
  readonly provider: JevProvider;
  readonly model: string;
  /** Model last used in the other API/Auth mode during this edit; restored on switching back. */
  readonly otherModeModel?: string;
  readonly apiKey: string;
  readonly authAttemptId?: string;
  readonly consent: boolean;
};

export type ConnectionFieldKey =
  | "name"
  | "provider"
  | "model"
  | "apiKey"
  | "baseUrl"
  | "headers"
  | "maxOutputTokens"
  | "enterpriseDomain"
  | "auth"
  | "consent";

/** Validation reasons, not rendered text, so a visible error follows a language switch. */
export type ConnectionErrors = Partial<Record<ConnectionFieldKey, ConnectionErrorKey>>;
export type BuildConnectionResult<T> =
  | { readonly ok: true; readonly connection: T }
  | { readonly ok: false; readonly errors: ConnectionErrors };
