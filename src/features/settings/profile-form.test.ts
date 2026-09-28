import { describe, expect, test } from "bun:test";
import type { AiSettingsView, ConnectionProfileView } from "@/lib/ai-settings";
import {
  buildProfileInput,
  buildSelectionInput,
  newProfileForm,
  profileFormFromView,
  selectionFromView,
} from "./profile-form";

const CHAT_ID = "123e4567-e89b-42d3-a456-426614174010";
const JEV_ID = "123e4567-e89b-42d3-a456-426614174011";

const chatProfile = {
  id: CHAT_ID,
  name: "로컬 채팅",
  purpose: "chat",
  connection: {
    provider: "openai-compatible",
    mode: "api",
    model: "local/model",
    baseUrl: "http://host.docker.internal:11434/v1",
    hasApiKey: true,
    headerNames: ["x-tenant"],
  },
} satisfies ConnectionProfileView;

function view(): AiSettingsView {
  return {
    chat: chatProfile.connection,
    jev: null,
    profiles: [chatProfile],
    chatId: CHAT_ID,
    jevId: null,
    chatManagedByEnvironment: false,
    jevManagedByEnvironment: false,
  };
}

describe("profile form", () => {
  test("restores and saves an explicitly keyless custom connection", () => {
    const profile = {
      ...chatProfile,
      connection: { ...chatProfile.connection, hasApiKey: false },
    };
    const form = profileFormFromView(profile);
    expect(form.chat.keyless).toBe(true);
    expect(buildProfileInput("chat", form, profile)).toMatchObject({
      ok: true,
      input: { connection: { apiKey: "", baseUrl: profile.connection.baseUrl } },
    });
  });

  test("defaults Copilot Auth to Responses while retaining explicit protocols", () => {
    const profile = {
      id: CHAT_ID,
      name: "Copilot",
      purpose: "chat",
      connection: {
        provider: "github-copilot",
        mode: "auth",
        model: "gpt-5.4-mini",
        hasApiKey: false,
        hasCredential: true,
      },
    } satisfies ConnectionProfileView;
    expect(buildProfileInput("chat", profileFormFromView(profile), profile)).toMatchObject({
      ok: true,
      input: { connection: { apiFormat: "responses" } },
    });
    const explicitProtocol = {
      ...profile,
      connection: { ...profile.connection, apiFormat: "chat-completions" as const },
    } satisfies ConnectionProfileView;
    expect(profileFormFromView(explicitProtocol).chat.apiFormat).toBe("chat-completions");
  });

  test("requires a key when a saved keyless connection is unchecked", () => {
    const profile = {
      ...chatProfile,
      connection: { ...chatProfile.connection, hasApiKey: false },
    };
    const restored = profileFormFromView(profile);
    const form = { ...restored, chat: { ...restored.chat, keyless: false } };
    const missing = buildProfileInput("chat", form, profile);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors["chat.apiKey"]).toBeString();
    expect(buildProfileInput("chat", {
      ...form, chat: { ...form.chat, apiKey: "new-fixture-key" },
    }, profile)).toMatchObject({
      ok: true, input: { connection: { apiKey: "new-fixture-key" } },
    });
  });

  test("builds a new profile without changing active selections", () => {
    const state = newProfileForm("jev");
    const result = buildProfileInput("jev", {
      ...state,
      jev: {
        ...state.jev,
        name: "OpenRouter Jev",
        mode: "auth",
        provider: "openrouter",
        model: "~typesafe/jev-latest",
        authAttemptId: JEV_ID,
        consent: true,
      },
    }, null);
    expect(result).toEqual({
      ok: true,
      input: {
        purpose: "jev",
        name: "OpenRouter Jev",
        connection: {
          mode: "auth",
          provider: "openrouter",
          model: "~typesafe/jev-latest",
          authAttemptId: JEV_ID,
        },
        consent: true,
      },
    });
    expect(selectionFromView(view()).chat).toBe(CHAT_ID);
  });

  test("editing an unchanged destination omits redacted secrets and headers", () => {
    const state = profileFormFromView(chatProfile);
    const result = buildProfileInput("chat", {
      ...state,
      chat: { ...state.chat, consent: true },
    }, chatProfile);
    expect(result).toEqual({
      ok: true,
      input: {
        purpose: "chat",
        name: "로컬 채팅",
        connection: {
          mode: "api",
          provider: "openai-compatible",
          model: "local/model",
          baseUrl: "http://host.docker.internal:11434/v1",
          apiFormat: "chat-completions",
        },
        consent: true,
      },
    });
  });
});

describe("selection form", () => {
  test("supports saved, environment, and off choices independently", () => {
    expect(buildSelectionInput({
      chat: CHAT_ID,
      chatConsent: true,
      jev: "environment",
      jevConsent: true,
    })).toEqual({
      chat: { mode: "saved", id: CHAT_ID },
      chatConsent: true,
      jev: { mode: "environment" },
      jevConsent: true,
    });
    expect(buildSelectionInput({
      chat: "off",
      chatConsent: true,
      jev: "off",
      jevConsent: true,
    })).toEqual({
      chat: null,
      chatConsent: false,
      jev: null,
      jevConsent: false,
    });
  });
});
