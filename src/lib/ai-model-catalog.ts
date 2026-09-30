import type { AI_PROVIDERS, AiProvider, JEV_PROVIDERS, JevProvider } from "./ai-providers";

/** A model selectable for an account-Auth connection. The ID is sent to the provider unchanged. */
export type AuthModelOption = {
  readonly id: string;
  /** Listed by the provider, but only some accounts or plans can use it. */
  readonly accountGated?: true;
};

export type AuthModelCatalog = {
  /** Newest first. */
  readonly models: readonly [AuthModelOption, ...AuthModelOption[]];
  /** Preselected for a new Auth connection; always one of `models`. */
  readonly defaultId: string;
};

export type ChatAuthProvider = Extract<(typeof AI_PROVIDERS)[number], { readonly supportsAuth: true }>["id"];
export type JevAuthProvider = Extract<(typeof JEV_PROVIDERS)[number], { readonly supportsAuth: true }>["id"];

// IDs from .omo/evidence/device-auth-models/model-sources.md (verified 2026-09-30), newest
// first by known release date, or by version where no date is published. Saved IDs that
// later leave these lists stay selectable for their own connection (see model-choice.ts).
export const CHAT_AUTH_MODELS = {
  openai: {
    models: [
      { id: "gpt-6.1-sol" },
      { id: "gpt-6-sol" },
      { id: "gpt-6-luna" },
      { id: "gpt-6-astra" },
      { id: "gpt-5.6-sol" },
      { id: "gpt-5.6-terra" },
      { id: "gpt-5.6-luna" },
    ],
    defaultId: "gpt-6.1-sol",
  },
  google: {
    models: [
      { id: "gemini-3.8-flash", accountGated: true },
      { id: "gemini-3.5-flash" },
      { id: "gemini-3.5-flash-lite" },
      { id: "gemini-3.1-flash-lite" },
      { id: "gemini-3.1-pro-preview" },
    ],
    defaultId: "gemini-3.5-flash",
  },
  "github-copilot": {
    models: [
      { id: "gpt-6-sol" },
      { id: "gpt-6-luna" },
      { id: "claude-opus-5.5" },
      { id: "gpt-6-astra" },
    ],
    defaultId: "gpt-6-luna",
  },
  openrouter: {
    models: [
      { id: "openai/gpt-6.1-sol" },
      { id: "anthropic/claude-sonnet-5.5" },
      { id: "openai/gpt-6-luna" },
      { id: "openai/gpt-6-sol" },
      { id: "anthropic/claude-opus-5.5" },
      { id: "x-ai/grok-4.7" },
      { id: "google/gemini-3.8-flash" },
    ],
    defaultId: "openai/gpt-6.1-sol",
  },
  xai: {
    models: [{ id: "grok-4.7" }, { id: "grok-4.6" }, { id: "grok-4.5" }, { id: "grok-4.3" }],
    defaultId: "grok-4.7",
  },
} as const satisfies Record<ChatAuthProvider, AuthModelCatalog>;

export const JEV_AUTH_MODELS = {
  openrouter: { models: [{ id: "~typesafe/jev-latest" }], defaultId: "~typesafe/jev-latest" },
} as const satisfies Record<JevAuthProvider, AuthModelCatalog>;

const chatCatalogs: Partial<Record<AiProvider, AuthModelCatalog>> = CHAT_AUTH_MODELS;
const jevCatalogs: Partial<Record<JevProvider, AuthModelCatalog>> = JEV_AUTH_MODELS;

/** Auth model list for a chat provider; null for API-only providers. */
export function chatAuthModels(provider: AiProvider): AuthModelCatalog | null {
  return chatCatalogs[provider] ?? null;
}

/** Auth model list for a Jev provider; null for API-only providers. */
export function jevAuthModels(provider: JevProvider): AuthModelCatalog | null {
  return jevCatalogs[provider] ?? null;
}
