import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveCodexAuth, type CodexSession } from "./auth";
import { consumeResponseStream, createCodexProvider } from "./provider";

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function jwt(payload: Record<string, unknown>): string {
  return `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

function stream(parts: string[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      const part = parts[index++];
      if (part === undefined) controller.close();
      else controller.enqueue(new TextEncoder().encode(part));
    },
  });
}

describe("Codex authentication", () => {
  test("accepts only a ChatGPT auth-file session with an account id", () => {
    const token = jwt({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } });
    expect(resolveCodexAuth(JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: token, refresh_token: "refresh-1" },
    }), "/codex/auth.json")).toEqual({
      kind: "chatgpt",
      accessToken: token,
      accountId: "acct-1",
      refreshToken: "refresh-1",
      authFilePath: "/codex/auth.json",
    });
    expect(resolveCodexAuth(JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: "secret" })))
      .toEqual({ kind: "blocked" });
  });
});

describe("Codex provider", () => {
  test("parses CRLF events split across arbitrary chunk boundaries", async () => {
    const deltas: string[] = [];
    const text = await consumeResponseStream(stream([
      "data: {\"type\":\"response.output_text.delta\",\"delta\":\"나뉜\"}\r",
      "\n\r\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\" 응답\"}\r\n",
      "\r\ndata: {\"type\":\"response.compl",
      "eted\",\"response\":{}}\r\n\r\n",
    ]), (delta) => deltas.push(delta));

    expect(text).toBe("나뉜 응답");
    expect(deltas).toEqual(["나뉜", " 응답"]);
  });

  test("rejects failed, incomplete, and delta-only truncated streams", async () => {
    const cases = [
      ['data: {"type":"response.failed","response":{}}\n\n'],
      ['data: {"type":"response.output_text.delta","delta":"부분"}\n\n',
        'data: {"type":"response.incomplete","response":{}}\n\n'],
      ['data: {"type":"response.output_text.delta","delta":"잘린 응답"}\n\n'],
    ];

    for (const parts of cases) {
      await expect(consumeResponseStream(stream(parts), () => undefined)).rejects.toMatchObject({
        name: "ChatProviderError",
      });
    }
  });

  test("refreshes an expired token, persists it, and uses it for the streamed response", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sb-chat-auth-"));
    temporaryDirectories.push(directory);
    const authFilePath = path.join(directory, "auth.json");
    const expired = jwt({ exp: Math.floor(Date.now() / 1000) - 60 });
    const fresh = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    await writeFile(authFilePath, JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: expired, refresh_token: "refresh-1", account_id: "acct-1" },
    }));
    const session: CodexSession = {
      kind: "chatgpt",
      accessToken: expired,
      accountId: "acct-1",
      refreshToken: "refresh-1",
      authFilePath,
    };
    const calls: Array<{ url: string; authorization: string }> = [];
    const provider = createCodexProvider(session, {
      fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), authorization: new Headers(init?.headers).get("authorization") ?? "" });
        if (String(url) === "https://refresh.test/token") {
          return Response.json({ access_token: fresh, refresh_token: "refresh-2" });
        }
        return new Response([
          'data: {"type":"response.output_text.delta","delta":"새 응답"}',
          "",
          'data: {"type":"response.completed","response":{}}',
          "",
        ].join("\n"));
      }) as typeof fetch,
      env: {
        CODEX_REFRESH_TOKEN_URL_OVERRIDE: "https://refresh.test/token",
        CODEX_CHATGPT_BASE_URL: "https://provider.test/codex",
      },
    });

    await expect(provider.stream({ question: "질문", history: [], sources: [] }, () => undefined, new AbortController().signal))
      .resolves.toBe("새 응답");
    expect(calls).toEqual([
      { url: "https://refresh.test/token", authorization: "" },
      { url: "https://provider.test/codex/responses", authorization: `Bearer ${fresh}` },
    ]);
    const saved = JSON.parse(await readFile(authFilePath, "utf8")) as { tokens: { access_token: string; refresh_token: string } };
    expect(saved.tokens).toMatchObject({ access_token: fresh, refresh_token: "refresh-2" });
  });

  test("shares one refresh across concurrent sends and atomically preserves unrelated auth fields", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sb-chat-auth-"));
    temporaryDirectories.push(directory);
    const authFilePath = path.join(directory, "auth.json");
    const expired = jwt({ exp: Math.floor(Date.now() / 1000) - 60 });
    const fresh = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    await writeFile(authFilePath, JSON.stringify({
      auth_mode: "chatgpt",
      preserved: { theme: "dark" },
      tokens: { access_token: expired, refresh_token: "refresh-1", account_id: "acct-1", id_token: "keep-me" },
    }));
    const session: CodexSession = {
      kind: "chatgpt",
      accessToken: expired,
      accountId: "acct-1",
      refreshToken: "refresh-1",
      authFilePath,
    };
    let refreshCalls = 0;
    let releaseRefresh!: () => void;
    let refreshEntered!: () => void;
    const entered = new Promise<void>((resolve) => { refreshEntered = resolve; });
    const released = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    const provider = createCodexProvider(session, {
      fetchImpl: (async (url: RequestInfo | URL) => {
        if (String(url) === "https://refresh.test/token") {
          refreshCalls += 1;
          refreshEntered();
          await released;
          return Response.json({ access_token: fresh, refresh_token: "refresh-2" });
        }
        return new Response([
          'data: {"type":"response.output_text.delta","delta":"완료"}',
          "",
          'data: {"type":"response.completed","response":{}}',
          "",
        ].join("\n"));
      }) as typeof fetch,
      env: {
        CODEX_REFRESH_TOKEN_URL_OVERRIDE: "https://refresh.test/token",
        CODEX_CHATGPT_BASE_URL: "https://provider.test/codex",
      },
    });
    const input = { question: "질문", history: [], sources: [] };

    const first = provider.stream(input, () => undefined, new AbortController().signal);
    await entered;
    const second = provider.stream(input, () => undefined, new AbortController().signal);
    releaseRefresh();

    await expect(Promise.all([first, second])).resolves.toEqual(["완료", "완료"]);
    expect(refreshCalls).toBe(1);
    const saved = JSON.parse(await readFile(authFilePath, "utf8")) as Record<string, unknown>;
    expect(saved).toMatchObject({
      auth_mode: "chatgpt",
      preserved: { theme: "dark" },
      tokens: {
        access_token: fresh,
        refresh_token: "refresh-2",
        account_id: "acct-1",
        id_token: "keep-me",
      },
    });
    expect((await Array.fromAsync(new Bun.Glob("auth.json.*.tmp").scan(directory)))).toEqual([]);
  });
});
