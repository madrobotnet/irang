import type { PoolClient } from "pg";
import {
  ChatConnectionSchema, JevConnectionSchema,
  type ChatConnection, type JevConnection,
} from "@/lib/ai-settings";
import { StoredJevConnectionSchema, type ChatInput, type JevInput, type StoredJevConnection } from "@/lib/ai-connections";
import { isCustomProvider } from "@/lib/ai-providers";
import { consumeAuthAttempt, type AiAuthScope } from "@/server/ai-auth/attempt-store";
import { ApiError } from "@/server/http";

export type ProfileResolveContext = {
  readonly client: PoolClient;
  readonly scope: AiAuthScope;
};

export async function resolveChatConnection(
  input: ChatInput,
  previous: ChatConnection | null,
  context: ProfileResolveContext,
): Promise<ChatConnection> {
  switch (input.mode) {
    case "api": {
      const unchanged = previous?.mode === "api"
        && previous.provider === input.provider && previous.baseUrl === input.baseUrl;
      const previousKey = unchanged && previous.mode === "api" ? previous.apiKey : undefined;
      const apiKey = input.apiKey ?? previousKey;
      if (apiKey === undefined) {
        throw new ApiError("validation", isCustomProvider(input.provider)
          ? "API 키를 입력하거나 키 없는 연결을 명시적으로 선택해 주세요."
          : "선택한 제공자의 API 키를 입력해 주세요.");
      }
      const headers = input.headers ?? (unchanged && previous.mode === "api" ? previous.headers : undefined);
      return ChatConnectionSchema.parse({ ...input, apiKey, ...(headers ? { headers } : {}) });
    }
    case "auth": {
      const { authAttemptId, ...connection } = input;
      switch (input.provider) {
        case "openai":
        case "google":
        case "github-copilot":
        case "openrouter":
        case "xai": {
          const previousCredential = previous?.mode === "auth"
            && previous.provider === input.provider && previous.enterpriseDomain === input.enterpriseDomain
            ? previous.credential : undefined;
          const credential = authAttemptId
            ? await consumeAuthAttempt(context.client, { id: authAttemptId, provider: input.provider, scope: context.scope })
            : previousCredential;
          // Existing file-backed profiles remain editable without replacing their
          // legacy credential source. New profiles must complete browser auth.
          if (!credential && !authAttemptId && (input.provider === "openai" || input.provider === "google")
            && previous?.mode === "auth" && previous.provider === input.provider) {
            return ChatConnectionSchema.parse(connection);
          }
          if (!credential) throw new ApiError("validation", "제공자 로그인을 완료한 뒤 연결을 저장해 주세요.");
          if (credential?.provider === "github-copilot" && credential.enterpriseDomain !== input.enterpriseDomain) {
            throw new ApiError("validation", "로그인한 GitHub 기업 도메인과 설정이 다릅니다. 다시 연결해 주세요.");
          }
          return ChatConnectionSchema.parse({ ...connection, ...(credential ? { credential } : {}) });
        }
        default: {
          const exhaustive: never = input;
          return exhaustive;
        }
      }
    }
    default: {
      const exhaustive: never = input;
      return exhaustive;
    }
  }
}

export async function resolveJevConnection(
  input: JevInput,
  previous: StoredJevConnection | null,
  context: ProfileResolveContext,
): Promise<StoredJevConnection> {
  if (input.mode === "auth") {
    const previousCredential = previous?.mode === "auth" ? previous.credential : undefined;
    const credential = input.authAttemptId
      ? await consumeAuthAttempt(context.client, { id: input.authAttemptId, provider: "openrouter", scope: context.scope })
      : previousCredential;
    if (!credential) throw new ApiError("validation", "OpenRouter 로그인을 완료한 뒤 Jev 연결을 저장해 주세요.");
    return StoredJevConnectionSchema.parse({
      mode: "auth", provider: "openrouter", model: input.model,
      ...(credential ? { credential } : {}),
    });
  }
  const previousKey = previous && previous.mode !== "auth" && previous.provider === input.provider
    ? previous.apiKey : undefined;
  const apiKey = input.apiKey ?? previousKey;
  if (!apiKey) throw new ApiError("validation", "선택한 Jev 제공자의 API 키를 입력해 주세요.");
  return JevConnectionSchema.parse({ provider: input.provider, model: input.model, apiKey });
}

export function resolvedJevConnection(connection: StoredJevConnection): JevConnection | null {
  if (connection.mode === "auth") {
    return connection.credential
      ? { provider: "openrouter", model: connection.model, apiKey: connection.credential.accessToken }
      : null;
  }
  return { provider: connection.provider, model: connection.model, apiKey: connection.apiKey };
}
