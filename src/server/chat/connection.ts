import type { AiProvider } from "@/lib/ai-settings";
import type { Locale } from "@/lib/i18n/locale";
import { readinessCopy } from "@/server/i18n/copy";
import { aiSelection } from "@/server/setup/ai-profile-store";
import { refreshedConnectionProfile } from "@/server/ai-auth/refresh";
import { createGoogleProfileProvider } from "@/server/ai-auth/google-profile";
import { loadCodexAuth, storedCodexSession } from "./auth";
import { createApiProvider } from "./api-provider";
import { getCliAuthReadiness } from "./cli-auth";
import { createCliProvider } from "./cli-provider";
import { createCodexProvider, type ChatProvider } from "./provider";

export type AuthConnectionStatus = {
  readonly provider: AiProvider;
  readonly available: boolean;
  readonly instructions: string;
  readonly detail: string;
};

export async function authConnections(locale: Locale = "ko"): Promise<readonly AuthConnectionStatus[]> {
  const [codex, google] = await Promise.all([loadCodexAuth(), getCliAuthReadiness("google", { locale })]);
  return [
    {
      provider: "openai",
      available: codex.kind === "chatgpt",
      instructions: "docker compose exec app codex login --device-auth",
      detail: codex.kind === "chatgpt"
        ? readinessCopy.codexReady[locale]
        : readinessCopy.codexMissing[locale],
    },
    {
      provider: "anthropic",
      available: false,
      instructions: "",
      detail: readinessCopy.claudeKeyOnly[locale],
    },
    google,
  ];
}

export async function configuredChatProvider(): Promise<ChatProvider | null> {
  const selected = await aiSelection("chat");
  if (selected.source === "environment") {
    const auth = await loadCodexAuth();
    return auth.kind === "chatgpt" ? createCodexProvider(auth) : null;
  }
  if (selected.source === "disabled" || selected.profile.purpose !== "chat") return null;
  const profile = selected.profile.connection.mode === "auth"
    ? await refreshedConnectionProfile(selected.profile.id) : selected.profile;
  if (!profile || profile.purpose !== "chat") return null;
  const connection = profile.connection;
  switch (connection.mode) {
    case "api":
      return createApiProvider(connection);
    case "auth":
      switch (connection.provider) {
        case "openai": {
          if (connection.credential?.provider === "openai") {
            return createCodexProvider(storedCodexSession(profile.id, connection.credential),
              { env: { ...process.env, CODEX_MODEL: connection.model } });
          }
          const auth = await loadCodexAuth();
          return auth.kind === "chatgpt"
            ? createCodexProvider(auth, { env: { ...process.env, CODEX_MODEL: connection.model } })
            : null;
        }
        case "google": {
          if (connection.credential?.provider === "google") return createGoogleProfileProvider(profile.id);
          const status = await getCliAuthReadiness("google");
          return status.available ? createCliProvider({ provider: "google", model: connection.model }) : null;
        }
        case "github-copilot":
        case "openrouter":
        case "xai": {
          const credential = connection.credential;
          if (!credential) return null;
          return createApiProvider({
            provider: connection.provider, apiKey: credential.accessToken, model: connection.model,
            ...(connection.apiFormat ? { apiFormat: connection.apiFormat } : {}),
            ...(credential.provider === "github-copilot" && credential.baseUrl ? { baseUrl: credential.baseUrl } : {}),
          });
        }
        default: {
          const exhaustive: never = connection;
          return exhaustive;
        }
      }
    default: {
      const exhaustive: never = connection;
      return exhaustive;
    }
  }
}
