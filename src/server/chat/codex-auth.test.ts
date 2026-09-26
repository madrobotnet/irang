import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCodexGenerator, setCodexGeneratorForTests } from "./codex";
import { CodexFailedError } from "./errors";
import {
  generateCodexTurn,
  readCodexResponsesText,
  resolveCodexAuth,
  type CodexTurnRequest,
} from "./codex-auth";

const QUESTION: CodexTurnRequest = {
  route: "answer",
  question: "Who owns the notes?",
  notes: [{ noteId: "note-1", title: "Ownership", excerpt: "The operator owns uploaded notes." }],
};

function jwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `e30.${body}.sig`;
}

function chatgptAuthFile(accountId: string, exp: number): string {
  return JSON.stringify({
    auth_mode: "chatgpt",
    OPENAI_API_KEY: null,
    tokens: {
      id_token: jwt({}),
      access_token: jwt({
        exp,
        "https://api.openai.com/auth": { chatgpt_account_id: accountId },
      }),
      refresh_token: "refresh-from-auth-file",
      account_id: accountId,
    },
    last_refresh: "2026-09-01T00:00:00.000Z",
  });
}

describe("resolveCodexAuth", () => {
  it("prefers the ChatGPT session in auth.json over env API keys", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const auth = resolveCodexAuth({
      env: {
        CODEX_API_KEY: "env-codex-key",
        OPENAI_API_KEY: "env-openai-key",
      },
      authFile: {
        path: "/codex-home/auth.json",
        text: chatgptAuthFile("acct-1", exp),
      },
    });
    expect(auth).toEqual({
      kind: "chatgpt",
      accessToken: jwt({
        exp,
        "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" },
      }),
      accountId: "acct-1",
      refreshToken: "refresh-from-auth-file",
      authFilePath: "/codex-home/auth.json",
    });
  });

  it("fails closed when the ChatGPT session has no account id, even if an env key is set", () => {
    const auth = resolveCodexAuth({
      env: { CODEX_API_KEY: "env-codex-key" },
      authFile: {
        path: "/codex-home/auth.json",
        text: JSON.stringify({
          auth_mode: "chatgpt",
          tokens: { access_token: "access-without-account", refresh_token: "refresh-1" },
        }),
      },
    });
    expect(auth).toEqual({ kind: "blocked" });
  });

  it("blocks an API key stored in auth.json", () => {
    expect(
      resolveCodexAuth({
        env: {},
        authFile: {
          path: "/codex-home/auth.json",
          text: JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: "file-key" }),
        },
      }),
    ).toEqual({ kind: "blocked" });
  });

  it("ignores env API keys when no Codex auth file is present", () => {
    expect(
      resolveCodexAuth({
        env: { CODEX_API_KEY: "env-codex-key", OPENAI_API_KEY: "env-openai-key" },
        authFile: null,
      }),
    ).toEqual({ kind: "absent" });
  });
});

describe("generateCodexTurn", () => {
  it("answers from the ChatGPT Codex responses endpoint and ignores env keys", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = jwt({
      exp,
      "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" },
    });
    const calls: Array<{ url: string; authorization: string; accountId: string; model: string }> = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body)) as { model: string };
      calls.push({
        url: String(url),
        authorization: headers.get("authorization") ?? "",
        accountId: headers.get("chatgpt-account-id") ?? "",
        model: body.model,
      });
      const sse = [
        'event: response.output_text.delta',
        'data: {"type":"response.output_text.delta","delta":"The operator owns uploaded notes."}',
        "",
        "data: [DONE]",
        "",
      ].join("\n");
      return new Response(sse, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    const result = await generateCodexTurn({
      auth: {
        kind: "chatgpt",
        accessToken,
        accountId: "acct-1",
        refreshToken: "refresh-from-auth-file",
        authFilePath: "/codex-home/auth.json",
      },
      request: QUESTION,
      fetchImpl: fetchImpl as typeof fetch,
      env: { CODEX_API_KEY: "env-codex-key", CODEX_MODEL: "gpt-test-model" },
    });

    expect(result).toEqual({ text: "The operator owns uploaded notes.", proposal: null });
    expect(calls).toEqual([
      {
        url: "https://chatgpt.com/backend-api/codex/responses",
        authorization: `Bearer ${accessToken}`,
        accountId: "acct-1",
        model: "gpt-test-model",
      },
    ]);
  });

  it("refreshes an expired ChatGPT access token and then answers", async () => {
    const expired = jwt({
      exp: Math.floor(Date.now() / 1000) - 60,
      "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" },
    });
    const refreshed = jwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" },
    });
    const persisted: string[] = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target === "https://auth.openai.com/oauth/token") {
        return new Response(
          JSON.stringify({ access_token: refreshed, refresh_token: "refresh-2", id_token: jwt({}) }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe(`Bearer ${refreshed}`);
      return new Response('data: {"type":"response.output_text.delta","delta":"Refreshed answer."}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    const result = await generateCodexTurn({
      auth: {
        kind: "chatgpt",
        accessToken: expired,
        accountId: "acct-1",
        refreshToken: "refresh-from-auth-file",
        authFilePath: "/codex-home/auth.json",
      },
      request: QUESTION,
      fetchImpl: fetchImpl as typeof fetch,
      env: {},
      persistChatGptSession: async (session) => {
        persisted.push(session.accessToken);
      },
    });

    expect(result.text).toBe("Refreshed answer.");
    expect(persisted).toEqual([refreshed]);
  });

  it("throws codex_failed and does not call the network when auth is absent", async () => {
    const fetchImpl = vi.fn();
    await expect(
      generateCodexTurn({
        auth: { kind: "absent" },
        request: QUESTION,
        fetchImpl: fetchImpl as typeof fetch,
        env: {},
      }),
    ).rejects.toMatchObject({ name: "CodexFailedError", code: "codex_failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("getCodexGenerator", () => {
  afterEach(() => {
    setCodexGeneratorForTests(null);
    vi.unstubAllGlobals();
    delete process.env.CODEX_HOME;
    delete process.env.CODEX_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.CODEX_MODEL;
  });

  it("sends the auth.json ChatGPT access token when an env API key is also set", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = jwt({
      exp,
      "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" },
    });
    const home = await mkdtemp(path.join(tmpdir(), "codex-auth-"));
    await writeFile(
      path.join(home, "auth.json"),
      JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          access_token: accessToken,
          refresh_token: "refresh-from-auth-file",
          account_id: "acct-1",
        },
      }),
      { mode: 0o600 },
    );
    process.env.CODEX_HOME = home;
    process.env.CODEX_API_KEY = "env-codex-key";
    process.env.CODEX_MODEL = "gpt-test-model";
    const calls: Array<{ url: string; authorization: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(url),
          authorization: new Headers(init?.headers).get("authorization") ?? "",
        });
        return new Response(
          'data: {"type":"response.output_text.delta","delta":"The operator owns uploaded notes."}\n\n',
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }),
    );

    const result = await getCodexGenerator().generate(QUESTION);

    expect(result).toEqual({ text: "The operator owns uploaded notes.", proposal: null });
    expect(calls).toEqual([
      {
        url: "https://chatgpt.com/backend-api/codex/responses",
        authorization: `Bearer ${accessToken}`,
      },
    ]);
  });
});

describe("readCodexResponsesText", () => {
  it("reads output text from a responses SSE body", () => {
    const body = [
      'data: {"type":"response.output_text.delta","delta":"The operator "}',
      "",
      'data: {"type":"response.output_text.delta","delta":"owns uploaded notes."}',
      "",
    ].join("\n");
    expect(readCodexResponsesText(body, "text/event-stream")).toBe("The operator owns uploaded notes.");
  });

  it("rejects an empty responses body", () => {
    expect(() => readCodexResponsesText('data: {"type":"response.completed","response":{}}\n\n', "text/event-stream")).toThrow(
      CodexFailedError,
    );
  });
});
