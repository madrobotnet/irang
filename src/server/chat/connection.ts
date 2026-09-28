import type { AiProvider } from "@/lib/ai-settings";
import { storedAiSettings } from "@/server/setup/settings";
import { loadCodexAuth } from "./auth";
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

export async function authConnections(): Promise<readonly AuthConnectionStatus[]> {
  const [codex, google] = await Promise.all([loadCodexAuth(), getCliAuthReadiness("google")]);
  return [
    {
      provider: "openai",
      available: codex.kind === "chatgpt",
      instructions: "docker compose exec app codex login --device-auth",
      detail: codex.kind === "chatgpt"
        ? "ChatGPT 로그인 파일을 확인했습니다. 계정 유효성과 모델 사용 권한은 실제 요청 시 확인됩니다."
        : "서버에서 공식 Codex CLI의 ChatGPT 로그인을 완료해 주세요.",
    },
    {
      provider: "anthropic",
      available: false,
      instructions: "",
      detail: "Claude는 API 키 연결만 지원합니다.",
    },
    google,
  ];
}

export async function configuredChatProvider(): Promise<ChatProvider | null> {
  const saved = await storedAiSettings();
  if (saved === null) {
    const auth = await loadCodexAuth();
    return auth.kind === "chatgpt" ? createCodexProvider(auth) : null;
  }
  const connection = saved.chat;
  if (!connection) return null;
  switch (connection.mode) {
    case "api":
      return createApiProvider(connection);
    case "auth":
      switch (connection.provider) {
        case "openai": {
          const auth = await loadCodexAuth();
          return auth.kind === "chatgpt"
            ? createCodexProvider(auth, { env: { ...process.env, CODEX_MODEL: connection.model } })
            : null;
        }
        case "google": {
          const status = await getCliAuthReadiness("google");
          return status.available ? createCliProvider({ provider: "google", model: connection.model }) : null;
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
