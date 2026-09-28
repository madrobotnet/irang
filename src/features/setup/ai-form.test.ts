import { describe, expect, test } from "bun:test";
import { ApiClientError } from "@/lib/api-client";
import {
  aiFormFromView,
  buildAiInput,
  emptyAiForm,
  setupFailure,
  validateSetupSecrets,
  type AiFormState,
} from "./ai-form";

const enabledChat: AiFormState = {
  chat: { enabled: true, mode: "api", provider: "anthropic", model: "claude-sonnet-4-6", apiKey: "sk-ant-test", consent: true },
  jev: { enabled: false, provider: "typesafe", model: "jev-latest", apiKey: "", consent: false },
};

describe("emptyAiForm", () => {
  test("defaults to both AI features off with provider default models", () => {
    const state = emptyAiForm();
    expect(state.chat.enabled).toBe(false);
    expect(state.jev.enabled).toBe(false);
    expect(state.chat.model.length).toBeGreaterThan(0);
    expect(state.jev.model).toBe("jev-latest");
  });

  test("builds an all-off payload with no consent", () => {
    const result = buildAiInput(emptyAiForm(), null);
    expect(result).toEqual({ ok: true, input: { chat: null, chatConsent: false, jev: null, jevConsent: false } });
  });
});

describe("buildAiInput chat", () => {
  test("sends an api-mode chat connection with the entered key", () => {
    const result = buildAiInput(enabledChat, null);
    expect(result).toEqual({
      ok: true,
      input: {
        chat: { mode: "api", provider: "anthropic", model: "claude-sonnet-4-6", apiKey: "sk-ant-test" },
        chatConsent: true,
        jev: null,
        jevConsent: false,
      },
    });
  });

  test("requires consent when chat is enabled", () => {
    const state: AiFormState = { ...enabledChat, chat: { ...enabledChat.chat, consent: false } };
    const result = buildAiInput(state, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["chat.consent"]).toBeString();
  });

  test("requires an API key when nothing is saved for the provider", () => {
    const state: AiFormState = { ...enabledChat, chat: { ...enabledChat.chat, apiKey: "" } };
    const result = buildAiInput(state, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["chat.apiKey"]).toBeString();
  });

  test("omits the key so an unchanged provider retains the saved key", () => {
    const state: AiFormState = { ...enabledChat, chat: { ...enabledChat.chat, apiKey: "" } };
    const saved = { chat: { provider: "anthropic", mode: "api", model: "claude-sonnet-4-6", hasApiKey: true }, jev: null, jevManagedByEnvironment: false, chatManagedByEnvironment: false } as const;
    const result = buildAiInput(state, saved);
    expect(result).toEqual({
      ok: true,
      input: {
        chat: { mode: "api", provider: "anthropic", model: "claude-sonnet-4-6" },
        chatConsent: true,
        jev: null,
        jevConsent: false,
      },
    });
  });

  test("requires a fresh key after switching providers even when one is saved", () => {
    const state: AiFormState = { ...enabledChat, chat: { ...enabledChat.chat, provider: "openai", apiKey: "" } };
    const saved = { chat: { provider: "anthropic", mode: "api", model: "claude-sonnet-4-6", hasApiKey: true }, jev: null, jevManagedByEnvironment: false, chatManagedByEnvironment: false } as const;
    const result = buildAiInput(state, saved);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["chat.apiKey"]).toBeString();
  });

  test("auth mode carries no API key and rejects Claude", () => {
    const google: AiFormState = { ...enabledChat, chat: { enabled: true, mode: "auth", provider: "google", model: "gemini-2.5-flash", apiKey: "", consent: true } };
    expect(buildAiInput(google, null)).toEqual({
      ok: true,
      input: { chat: { mode: "auth", provider: "google", model: "gemini-2.5-flash" }, chatConsent: true, jev: null, jevConsent: false },
    });
    const claude: AiFormState = { ...google, chat: { ...google.chat, provider: "anthropic" } };
    const result = buildAiInput(claude, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["chat.provider"]).toBeString();
  });

  test("rejects a blank model", () => {
    const state: AiFormState = { ...enabledChat, chat: { ...enabledChat.chat, model: "   " } };
    const result = buildAiInput(state, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["chat.model"]).toBeString();
  });
});

describe("buildAiInput jev", () => {
  const withJev: AiFormState = {
    chat: { enabled: false, mode: "api", provider: "openai", model: "gpt-5.4-mini", apiKey: "", consent: false },
    jev: { enabled: true, provider: "openrouter", model: "~typesafe/jev-latest", apiKey: "or-key", consent: true },
  };

  test("keeps TypeSafe and OpenRouter as separate choices", () => {
    const result = buildAiInput(withJev, null);
    expect(result).toEqual({
      ok: true,
      input: { chat: null, chatConsent: false, jev: { provider: "openrouter", model: "~typesafe/jev-latest", apiKey: "or-key" }, jevConsent: true },
    });
  });

  test("retains the saved key only for the unchanged Jev provider", () => {
    const saved = { chat: null, jev: { provider: "typesafe", model: "jev-latest", hasApiKey: true }, jevManagedByEnvironment: false, chatManagedByEnvironment: false } as const;
    const same: AiFormState = { ...withJev, jev: { ...withJev.jev, provider: "typesafe", model: "jev-latest", apiKey: "" } };
    expect(buildAiInput(same, saved)).toEqual({
      ok: true,
      input: { chat: null, chatConsent: false, jev: { provider: "typesafe", model: "jev-latest" }, jevConsent: true },
    });
    const switched: AiFormState = { ...withJev, jev: { ...withJev.jev, apiKey: "" } };
    const result = buildAiInput(switched, saved);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["jev.apiKey"]).toBeString();
  });

  test("requires Jev consent when enabled", () => {
    const result = buildAiInput({ ...withJev, jev: { ...withJev.jev, consent: false } }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["jev.consent"]).toBeString();
  });
});

describe("aiFormFromView", () => {
  test("prefills from redacted metadata without any key material", () => {
    const view = {
      chat: { provider: "google", mode: "auth", model: "gemini-2.5-flash", hasApiKey: false },
      jev: { provider: "typesafe", model: "jev-latest", hasApiKey: true },
      jevManagedByEnvironment: false,
      chatManagedByEnvironment: true,
    } as const;
    const state = aiFormFromView(view);
    expect(state.chat).toEqual({ enabled: true, mode: "auth", provider: "google", model: "gemini-2.5-flash", apiKey: "", consent: true });
    expect(state.jev.enabled).toBe(true);
    expect(state.jev.apiKey).toBe("");
  });

  test("returns all-off defaults when nothing is saved", () => {
    expect(aiFormFromView(null)).toEqual(emptyAiForm());
    expect(aiFormFromView({ chat: null, jev: null, jevManagedByEnvironment: false, chatManagedByEnvironment: false })).toEqual(emptyAiForm());
  });
});

describe("validateSetupSecrets", () => {
  const base = { setupToken: "a".repeat(32), password: "b".repeat(12), passwordConfirmation: "b".repeat(12) };
  test("accepts boundary-length secrets", () => {
    expect(validateSetupSecrets(base)).toEqual({});
  });
  test("flags short token, short password, and mismatch", () => {
    const errors = validateSetupSecrets({ setupToken: "short", password: "12345678901", passwordConfirmation: "12345678902" });
    expect(errors.setupToken).toBeString();
    expect(errors.password).toBeString();
    expect(errors.passwordConfirmation).toBeString();
  });
  test("flags an over-long password", () => {
    const errors = validateSetupSecrets({ ...base, password: "x".repeat(513), passwordConfirmation: "x".repeat(513) });
    expect(errors.password).toBeString();
  });
});

describe("setupFailure", () => {
  test("maps a wrong installer code to the token group with the server message", () => {
    const error = new ApiClientError(403, "forbidden", "server_error_detail");
    const failure = setupFailure(error);
    expect(failure.group).toBe("token");
    expect(failure.message).toBe(error.message);
  });
  test("maps conflict and unavailable to the whole form", () => {
    for (const status of [409, 503, 400]) {
      const error = new ApiClientError(status, "server_error", "server_error_detail");
      const failure = setupFailure(error);
      expect(failure.group).toBe("form");
      expect(failure.message).toBe(error.message);
    }
  });
  test("maps network failures to a retry message", () => {
    expect(setupFailure(new TypeError("fetch failed")).group).toBe("form");
  });
});
