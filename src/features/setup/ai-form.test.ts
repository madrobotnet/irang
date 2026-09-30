import { describe, expect, test } from "bun:test";
import type { AiSettingsView } from "@/lib/ai-settings";
import { ApiClientError } from "@/lib/api-client";
import { LOCALES } from "@/lib/i18n/locale";
import { AI_COPY } from "./ai-copy";
import {
  aiFormFromView,
  aiSaveFailureText,
  buildAiInput,
  emptyAiForm,
  type AiFieldKey,
  type AiFormState,
} from "./ai-form";

const JEV_ATTEMPT = "33333333-3333-4333-8333-333333333333";
const GOOGLE_ATTEMPT = "55555555-5555-4555-8555-555555555555";

function settingsView(input: Pick<AiSettingsView, "chat" | "jev">): AiSettingsView {
  return {
    ...input,
    profiles: [],
    chatId: null,
    jevId: null,
    chatManagedByEnvironment: false,
    jevManagedByEnvironment: false,
  };
}

describe("buildAiInput", () => {
  test("builds an all-off payload with no consent", () => {
    expect(buildAiInput(emptyAiForm(), null)).toEqual({
      ok: true,
      input: { chat: null, chatConsent: false, jev: null, jevConsent: false },
    });
  });

  test("creates named initial chat and Jev profiles", () => {
    const base = emptyAiForm();
    const result = buildAiInput({
      chat: {
        ...base.chat,
        enabled: true,
        name: "개인 OpenAI",
        provider: "openai",
        model: "gpt-5.4-mini",
        apiKey: "sk-test",
        consent: true,
      },
      jev: {
        ...base.jev,
        enabled: true,
        name: "업무 Jev",
        provider: "typesafe",
        model: "jev-latest",
        apiKey: "jev-test",
        consent: true,
      },
    }, null);
    expect(result).toEqual({
      ok: true,
      input: {
        chat: { mode: "api", provider: "openai", model: "gpt-5.4-mini", apiKey: "sk-test" },
        chatConsent: true,
        chatName: "개인 OpenAI",
        jev: { mode: "api", provider: "typesafe", model: "jev-latest", apiKey: "jev-test" },
        jevConsent: true,
        jevName: "업무 Jev",
      },
    });
  });

  test("retains a saved API key only for an unchanged destination", () => {
    const base = emptyAiForm();
    const saved = settingsView({
      chat: {
        provider: "openai-compatible",
        mode: "api",
        model: "local/model",
        baseUrl: "http://host.docker.internal:11434/v1",
        hasApiKey: true,
        headerNames: ["x-tenant"],
      },
      jev: null,
    });
    const same = buildAiInput({
      ...base,
      chat: {
        ...base.chat,
        enabled: true,
        provider: "openai-compatible",
        model: "local/model",
        baseUrl: "http://host.docker.internal:11434/v1/",
        consent: true,
      },
    }, saved);
    expect(same).toEqual({
      ok: true,
      input: {
        chat: {
          mode: "api",
          provider: "openai-compatible",
          model: "local/model",
          baseUrl: "http://host.docker.internal:11434/v1",
          apiFormat: "chat-completions",
        },
        chatConsent: true,
        jev: null,
        jevConsent: false,
      },
    });
    const changed = buildAiInput({
      ...base,
      chat: {
        ...base.chat,
        enabled: true,
        provider: "openai-compatible",
        model: "local/model",
        baseUrl: "http://host.docker.internal:22434/v1",
        consent: true,
      },
    }, saved);
    expect(changed.ok).toBe(false);
    if (!changed.ok) expect(changed.errors["chat.apiKey"]).toBe("apiKeyOrKeyless");
  });

  test("allows explicit keyless custom endpoints and explicit header clearing", () => {
    const base = emptyAiForm();
    const result = buildAiInput({
      ...base,
      chat: {
        ...base.chat,
        enabled: true,
        provider: "anthropic-compatible",
        model: "local:model@latest",
        baseUrl: "http://host.docker.internal:9000/api",
        apiFormat: "anthropic-messages",
        keyless: true,
        headerAction: "clear",
        consent: true,
      },
    }, null);
    expect(result).toEqual({
      ok: true,
      input: {
        chat: {
          mode: "api",
          provider: "anthropic-compatible",
          model: "local:model@latest",
          apiKey: "",
          baseUrl: "http://host.docker.internal:9000/api",
          apiFormat: "anthropic-messages",
          headers: {},
        },
        chatConsent: true,
        jev: null,
        jevConsent: false,
      },
    });
  });

  test("requires a ready browser auth attempt for a new web login", () => {
    const base = emptyAiForm();
    const pending = {
      ...base,
      chat: {
        ...base.chat,
        enabled: true,
        mode: "auth" as const,
        provider: "github-copilot" as const,
        model: "gpt-6-luna",
        enterpriseDomain: "github.example.com",
        consent: true,
      },
    };
    const missing = buildAiInput(pending, null);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors["chat.auth"]).toBe("browserLoginRequired");

    const ready = buildAiInput({
      ...pending,
      chat: { ...pending.chat, authAttemptId: "11111111-1111-4111-8111-111111111111" },
    }, null);
    expect(ready).toEqual({
      ok: true,
      input: {
        chat: {
          mode: "auth",
          provider: "github-copilot",
          model: "gpt-6-luna",
          apiFormat: "chat-completions",
          enterpriseDomain: "github.example.com",
          authAttemptId: "11111111-1111-4111-8111-111111111111",
        },
        chatConsent: true,
        jev: null,
        jevConsent: false,
      },
    });
  });

  test("keeps Jev API and OpenRouter Auth independent", () => {
    const base = emptyAiForm();
    const apiResult = buildAiInput({
      ...base,
      jev: {
        ...base.jev,
        enabled: true,
        provider: "typesafe",
        model: "jev-latest",
        apiKey: "jev-key",
        consent: true,
      },
    }, null);
    expect(apiResult.ok).toBe(true);

    const authResult = buildAiInput({
      ...base,
      jev: {
        ...base.jev,
        enabled: true,
        mode: "auth",
        provider: "openrouter",
        model: "~typesafe/jev-latest",
        authAttemptId: "22222222-2222-4222-8222-222222222222",
        consent: true,
      },
    }, null);
    expect(authResult).toEqual({
      ok: true,
      input: {
        chat: null,
        chatConsent: false,
        jev: {
          mode: "auth",
          provider: "openrouter",
          model: "~typesafe/jev-latest",
          authAttemptId: "22222222-2222-4222-8222-222222222222",
        },
        jevConsent: true,
      },
    });
  });

  test("requires consent for every enabled purpose", () => {
    const base = emptyAiForm();
    const result = buildAiInput({
      ...base,
      chat: { ...base.chat, enabled: true, apiKey: "sk-test" },
      jev: { ...base.jev, enabled: true, apiKey: "jev-test" },
    }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors["chat.consent"]).toBe("chatConsent");
      expect(result.errors["jev.consent"]).toBe("jevConsent");
    }
  });
});

describe("aiFormFromView", () => {
  test("prefills redacted metadata without secret material", () => {
    const state = aiFormFromView(settingsView({
      chat: { provider: "google", mode: "auth", model: "gemini-2.5-flash", hasApiKey: false },
      jev: { provider: "typesafe", mode: "api", model: "jev-latest", hasApiKey: true },
    }));
    expect(state.chat).toMatchObject({
      enabled: true, mode: "auth", provider: "google",
      model: "gemini-2.5-flash", apiKey: "", consent: true,
    });
    expect(state.jev.enabled).toBe(true);
    expect(state.jev.apiKey).toBe("");
  });

  test("returns all-off defaults when nothing is saved", () => {
    expect(aiFormFromView(null)).toEqual(emptyAiForm());
    expect(aiFormFromView(settingsView({ chat: null, jev: null }))).toEqual(emptyAiForm());
  });
});

describe("existing provider form contracts", () => {
  const base = emptyAiForm();
  const enabledChat: AiFormState = {
    ...base,
    chat: {
      ...base.chat, enabled: true, provider: "anthropic",
      model: "claude-sonnet-4-6", apiKey: "sk-ant-test", consent: true,
    },
  };

  test("defaults to both AI features off with provider default models", () => {
    expect(base.chat.enabled).toBe(false);
    expect(base.jev.enabled).toBe(false);
    expect(base.chat.model.length).toBeGreaterThan(0);
    expect(base.jev.model).toBe("jev-latest");
  });

  test("sends an api-mode chat connection with the entered key", () => {
    expect(buildAiInput(enabledChat, null)).toEqual({
      ok: true,
      input: {
        chat: { mode: "api", provider: "anthropic", model: "claude-sonnet-4-6", apiKey: "sk-ant-test" },
        chatConsent: true, jev: null, jevConsent: false,
      },
    });
  });

  test("requires an API key when nothing is saved for the provider", () => {
    const result = buildAiInput({ ...enabledChat, chat: { ...enabledChat.chat, apiKey: "" } }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["chat.apiKey"]).toBe("apiKeyRequired");
  });

  test("retains a native key only for the unchanged provider", () => {
    const saved = settingsView({
      chat: { provider: "anthropic", mode: "api", model: "claude-sonnet-4-6", hasApiKey: true },
      jev: null,
    });
    expect(buildAiInput({ ...enabledChat, chat: { ...enabledChat.chat, apiKey: "" } }, saved)).toEqual({
      ok: true,
      input: {
        chat: { mode: "api", provider: "anthropic", model: "claude-sonnet-4-6" },
        chatConsent: true, jev: null, jevConsent: false,
      },
    });
    const switched = buildAiInput({
      ...enabledChat, chat: { ...enabledChat.chat, provider: "openai", apiKey: "" },
    }, saved);
    expect(switched.ok).toBe(false);
    if (!switched.ok) expect(switched.errors["chat.apiKey"]).toBe("apiKeyRequired");
  });

  test("auth mode carries no API key and rejects Claude", () => {
    const google: AiFormState = {
      ...enabledChat,
      chat: {
        ...enabledChat.chat, mode: "auth", provider: "google", model: "gemini-3.5-flash", apiKey: "",
        authAttemptId: GOOGLE_ATTEMPT,
      },
    };
    expect(buildAiInput(google, null)).toEqual({
      ok: true,
      input: {
        chat: { mode: "auth", provider: "google", model: "gemini-3.5-flash", authAttemptId: GOOGLE_ATTEMPT },
        chatConsent: true, jev: null, jevConsent: false,
      },
    });
    const claude = buildAiInput({ ...google, chat: { ...google.chat, provider: "anthropic" } }, null);
    expect(claude.ok).toBe(false);
    if (!claude.ok) expect(claude.errors["chat.provider"]).toBe("apiKeyOnly");
  });

  test("rejects a blank model", () => {
    const result = buildAiInput({ ...enabledChat, chat: { ...enabledChat.chat, model: "   " } }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["chat.model"]).toBe("modelFormat");
  });

  test("Auth accepts listed models and the unchanged saved model, never other text", () => {
    const auth: AiFormState = {
      ...base,
      chat: { ...base.chat, enabled: true, mode: "auth", provider: "google", model: "typed-model", consent: true },
      jev: { ...base.jev, enabled: true, mode: "auth", provider: "openrouter", model: "typed/jev", authAttemptId: JEV_ATTEMPT, consent: true },
    };
    const unlisted = buildAiInput(auth, null);
    expect(unlisted.ok).toBe(false);
    if (!unlisted.ok) {
      expect(unlisted.errors["chat.model"]).toBe("authModelRequired");
      expect(unlisted.errors["jev.model"]).toBe("authModelRequired");
    }

    const saved = settingsView({
      chat: { provider: "google", mode: "auth", model: "gemini-2.5-flash", hasApiKey: false },
      jev: { provider: "openrouter", mode: "auth", model: "~typesafe/jev-1.0", hasApiKey: false, hasCredential: true },
    });
    const retained = buildAiInput({
      chat: { ...auth.chat, model: "gemini-2.5-flash" },
      jev: { ...auth.jev, model: "~typesafe/jev-1.0", authAttemptId: undefined },
    }, saved);
    expect(retained).toMatchObject({
      ok: true,
      input: { chat: { model: "gemini-2.5-flash" }, jev: { model: "~typesafe/jev-1.0" } },
    });

    const otherProvider = buildAiInput({ ...auth, chat: { ...auth.chat, provider: "xai", model: "gemini-2.5-flash" } }, saved);
    expect(otherProvider.ok).toBe(false);
    if (!otherProvider.ok) expect(otherProvider.errors["chat.model"]).toBe("authModelRequired");
  });

  test("API mode keeps free-text model IDs", () => {
    expect(buildAiInput({ ...enabledChat, chat: { ...enabledChat.chat, model: "claude-private-preview" } }, null))
      .toMatchObject({ ok: true, input: { chat: { mode: "api", model: "claude-private-preview" } } });
  });

  test("keeps TypeSafe and OpenRouter API choices separate", () => {
    expect(buildAiInput({
      ...base,
      jev: { ...base.jev, enabled: true, provider: "openrouter", model: "~typesafe/jev-latest", apiKey: "or-key", consent: true },
    }, null)).toEqual({
      ok: true,
      input: {
        chat: null, chatConsent: false,
        jev: { mode: "api", provider: "openrouter", model: "~typesafe/jev-latest", apiKey: "or-key" },
        jevConsent: true,
      },
    });
  });

  test("retains the saved key only for the unchanged Jev provider", () => {
    const saved = settingsView({
      chat: null, jev: { provider: "typesafe", mode: "api", model: "jev-latest", hasApiKey: true },
    });
    const same: AiFormState = {
      ...base, jev: { ...base.jev, enabled: true, provider: "typesafe", consent: true },
    };
    expect(buildAiInput(same, saved)).toEqual({
      ok: true,
      input: {
        chat: null, chatConsent: false,
        jev: { mode: "api", provider: "typesafe", model: "jev-latest" }, jevConsent: true,
      },
    });
    const switched = buildAiInput({ ...same, jev: { ...same.jev, provider: "openrouter" } }, saved);
    expect(switched.ok).toBe(false);
    if (!switched.ok) expect(switched.errors["jev.apiKey"]).toBe("jevApiKeyRequired");
  });
});

describe("connection problems are stable reasons, never schema message text", () => {
  const base = emptyAiForm();
  const LOCAL = "http://host.docker.internal:11434/v1";
  const custom = (patch: Partial<AiFormState["chat"]>) => buildAiInput({
    ...base,
    chat: { ...base.chat, enabled: true, provider: "openai-compatible", model: "local/model", keyless: true, consent: true, ...patch },
  }, null);
  const reason = (result: ReturnType<typeof buildAiInput>, key: AiFieldKey) => (result.ok ? null : result.errors[key]);

  test("base URL problems map to their own reasons", () => {
    expect(reason(custom({ baseUrl: "  " }), "chat.baseUrl")).toBe("baseUrlRequired");
    expect(reason(custom({ baseUrl: "not a url" }), "chat.baseUrl")).toBe("baseUrlInvalid");
    expect(reason(custom({ baseUrl: "http://user:secret@host.docker.internal/v1" }), "chat.baseUrl")).toBe("baseUrlUnsafe");
    expect(reason(custom({ baseUrl: `${LOCAL}?tenant=a` }), "chat.baseUrl")).toBe("baseUrlUnsafe");
    expect(reason(custom({ baseUrl: `https://host.example/${"a".repeat(2050)}` }), "chat.baseUrl")).toBe("baseUrlTooLong");
  });

  test("extra header problems map to their own reasons", () => {
    const headers = (headersJson: string) => reason(custom({ baseUrl: LOCAL, headerAction: "replace", headersJson }), "chat.headers");
    expect(headers("{")).toBe("headersNotObject");
    expect(headers("[]")).toBe("headersNotObject");
    expect(headers('{"Host":"x"}')).toBe("headersReserved");
    expect(headers(JSON.stringify(Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`x-h${index}`, "v"]))))).toBe("headersTooMany");
    expect(headers('{"bad header":"x"}')).toBe("headersInvalid");
    expect(custom({ baseUrl: LOCAL, headerAction: "replace", headersJson: '{"X-Tenant":"a"}' }))
      .toMatchObject({ ok: true, input: { chat: { headers: { "x-tenant": "a" } } } });
  });

  test("every reason the form can produce has copy in every locale", () => {
    for (const locale of LOCALES) {
      for (const key of Object.keys(AI_COPY.ko.errors) as (keyof typeof AI_COPY.ko.errors)[]) {
        expect(AI_COPY[locale].errors[key].trim()).not.toBe("");
      }
    }
  });
});

describe("aiSaveFailureText", () => {
  test("a retained failure follows the current locale; unexplained failures use local copy", () => {
    const localized = { ko: "ko-marker", en: "en-marker" };
    const withText = (status: number) =>
      new ApiClientError(status, "conflict", localized.en, { error: { code: "conflict", message: localized.en, localized } });
    for (const locale of LOCALES) {
      for (const status of [400, 409, 503]) expect(aiSaveFailureText(withText(status), locale)).toBe(localized[locale]);
      expect(aiSaveFailureText(withText(500), locale)).toBe(AI_COPY[locale].save.failed);
      expect(aiSaveFailureText(new ApiClientError(400, "validation", "legacy diagnostic"), locale)).toBe(AI_COPY[locale].save.failed);
      expect(aiSaveFailureText(new TypeError("fetch failed"), locale)).toBe(AI_COPY[locale].save.network);
    }
  });
});
