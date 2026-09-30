import { setupCopy } from "@/server/i18n/setup-copy";
import type { PoolClient } from "pg";
import {
  AI_PROVIDERS, JEV_PROVIDERS,
  type AiSettingsDocument, type AiSettingsInput, type ConnectionProfile,
} from "@/lib/ai-settings";
import type { ConnectionPurpose } from "@/lib/ai-providers";
import type { AiAuthScope } from "@/server/ai-auth/attempt-store";
import { ApiError } from "@/server/http";
import { legacyJevConnection } from "./ai-legacy";
import { connectionProfiles } from "./ai-profile-store";
import { writeConnectionProfile } from "./ai-profiles";

function requireProfile(profiles: readonly ConnectionProfile[], id: string, purpose: ConnectionPurpose): string {
  if (!profiles.some((profile) => profile.id === id && profile.purpose === purpose)) {
    throw new ApiError("validation", setupCopy.purposeMismatch);
  }
  return id;
}

export async function resolveAiSettings(
  client: PoolClient,
  input: AiSettingsInput,
  context: {
    readonly ownerId: string;
    readonly previous: AiSettingsDocument | null;
    readonly scope: AiAuthScope;
  },
): Promise<AiSettingsDocument> {
  if ((input.chat && !input.chatConsent) || (input.jev && !input.jevConsent)) {
    throw new ApiError("validation", setupCopy.consent);
  }
  const profiles = await connectionProfiles(context.ownerId, client);
  let chatId: string | null = null;
  if (input.chat) {
    switch (input.chat.mode) {
      case "saved":
        chatId = requireProfile(profiles, input.chat.id, "chat");
        break;
      case "environment":
        chatId = "environment";
        break;
      case "api":
      case "auth": {
        const connection = input.chat;
        const previous = profiles.find((profile) => profile.id === context.previous?.chatId && profile.purpose === "chat");
        const provider = AI_PROVIDERS.find((entry) => entry.id === connection.provider);
        const profile = await writeConnectionProfile(client, {
          purpose: "chat", name: input.chatName ?? previous?.name ?? provider?.name ?? connection.provider,
          connection, consent: true,
        }, { ownerId: context.ownerId, scope: context.scope, previous });
        chatId = profile.id;
        break;
      }
      default: {
        const exhaustive: never = input.chat;
        return exhaustive;
      }
    }
  }
  let jevId: string | null = null;
  if (input.jev) {
    switch (input.jev.mode) {
      case "saved":
        jevId = requireProfile(profiles, input.jev.id, "jev");
        break;
      case "environment":
        jevId = "environment";
        break;
      case undefined:
      case "api":
      case "auth": {
        const previous = profiles.find((profile) => profile.id === context.previous?.jevId && profile.purpose === "jev");
        const environmentManaged = context.previous === null || context.previous.jevId === "environment";
        const legacy = environmentManaged ? legacyJevConnection() : null;
        const connection = input.jev.mode !== "auth" && input.jev.apiKey === undefined && legacy?.provider === input.jev.provider
          ? { ...input.jev, apiKey: legacy.apiKey } : input.jev;
        const provider = JEV_PROVIDERS.find((entry) => entry.id === connection.provider);
        const profile = await writeConnectionProfile(client, {
          purpose: "jev", name: input.jevName ?? previous?.name ?? provider?.name ?? connection.provider,
          connection, consent: true,
        }, { ownerId: context.ownerId, scope: context.scope, previous });
        jevId = profile.id;
        break;
      }
      default: {
        const exhaustive: never = input.jev;
        return exhaustive;
      }
    }
  }
  return { version: 2, chatId, jevId };
}
