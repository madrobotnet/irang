import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { CodexFailedError } from "./errors";

export type CodexTurnRequest = {
  route: "answer" | "propose_edit";
  question: string;
  notes: Array<{ noteId: string; title: string; excerpt: string }>;
};

export type CodexTurnResult = {
  text: string;
  proposal: { title: string; body: string } | null;
};

export type CodexChatGptSession = {
  kind: "chatgpt";
  accessToken: string;
  accountId: string;
  refreshToken: string | null;
  authFilePath: string | null;
};

export type CodexAuth = CodexChatGptSession | { kind: "blocked" } | { kind: "absent" };

const REFRESH_URL = "https://auth.openai.com/oauth/token";
const OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CHATGPT_ORIGINATOR = "codex_cli_rs";
const CHATGPT_MODEL = "gpt-5.4-mini";
const AUTH_CLAIM = "https://api.openai.com/auth";

const CHATGPT_MODES = new Set(["chatgpt", "chatgptAuthTokens"]);

type CodexProcessEnv = Record<string, string | undefined>;

let refreshInFlight: Promise<CodexChatGptSession> | null = null;

export function codexAuthFilePath(env: CodexProcessEnv = process.env): string {
  const root = env.CODEX_HOME?.trim() || path.join(homedir(), ".codex");
  return path.join(root, "auth.json");
}

export function resolveCodexAuth(input: {
  env: CodexProcessEnv;
  authFile: { path: string; text: string } | null;
}): CodexAuth {
  if (input.authFile) {
    return authFromFile(input.authFile);
  }
  return { kind: "absent" };
}

export async function loadCodexAuth(env: CodexProcessEnv = process.env): Promise<CodexAuth> {
  const filePath = codexAuthFilePath(env);
  try {
    const text = await readFile(filePath, "utf8");
    return resolveCodexAuth({ env, authFile: { path: filePath, text } });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return resolveCodexAuth({ env, authFile: null });
    }
    return { kind: "blocked" };
  }
}

export function readCodexResponsesText(body: string, contentType: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new CodexFailedError("codex_empty");
  }
  if (contentType.includes("text/event-stream") || trimmed.startsWith("data:") || trimmed.startsWith("event:")) {
    return readSseText(trimmed);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new CodexFailedError("codex_response");
  }
  const text = textFromResponseObject(parsed).trim();
  if (!text) {
    throw new CodexFailedError("codex_empty");
  }
  return text;
}

export async function generateCodexTurn(input: {
  auth: CodexAuth;
  request: CodexTurnRequest;
  fetchImpl: typeof fetch;
  env: CodexProcessEnv;
  persistChatGptSession?: (session: CodexChatGptSession) => Promise<void>;
}): Promise<CodexTurnResult> {
  const notes = notesBlock(input.request.notes);
  if (input.request.route === "propose_edit") {
    const raw = await completeCodex(input, proposalSystem(), `Question:\n${input.request.question}\n\nNotes:\n${notes}`);
    const draft = parseProposalDraft(raw);
    if (!draft) {
      throw new CodexFailedError("codex_proposal");
    }
    return { text: draft.message, proposal: { title: draft.title, body: draft.body } };
  }
  const text = await completeCodex(input, answerSystem(), `Question:\n${input.request.question}\n\nNotes:\n${notes}`);
  return { text: text.trim(), proposal: null };
}

export async function organizeCodexNote(input: {
  auth: CodexAuth;
  title: string;
  body: string;
  fetchImpl: typeof fetch;
  env: CodexProcessEnv;
  persistChatGptSession?: (session: CodexChatGptSession) => Promise<void>;
}): Promise<{ title: string; body: string }> {
  const raw = await completeCodex(
    input,
    "Rewrite the note so it is easier to scan. Reply with JSON only: {\"message\":\"ignored\",\"title\":\"title\",\"body\":\"rewritten body\"}. Do not drop facts.",
    `Title:\n${input.title}\n\nBody:\n${input.body}`,
  );
  const draft = parseProposalDraft(raw);
  if (!draft) {
    throw new CodexFailedError("codex_proposal");
  }
  return { title: draft.title, body: draft.body };
}

export function parseProposalDraft(raw: string): { message: string; title: string; body: string } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const row = value as Record<string, unknown>;
    if (typeof row.message !== "string" || typeof row.title !== "string" || typeof row.body !== "string") {
      return null;
    }
    const message = row.message.trim();
    const title = row.title.trim();
    const body = row.body.trim();
    if (!message || !title || !body) {
      return null;
    }
    return { message, title, body };
  } catch {
    return null;
  }
}

function answerSystem(): string {
  return "Answer the question using only the supplied notes. Do not invent note ids. If the notes do not contain the answer, say so.";
}

function proposalSystem(): string {
  return "You draft a note edit for a person to approve. Reply with JSON only: {\"message\":\"short explanation\",\"title\":\"proposed title\",\"body\":\"proposed body\"}. Use only the supplied notes. Do not claim the edit is already saved.";
}

function notesBlock(notes: CodexTurnRequest["notes"]): string {
  return notes
    .map((note) => [`noteId: ${note.noteId}`, note.title, note.excerpt].filter((line) => line.length > 0).join("\n"))
    .join("\n\n");
}

function authFromFile(file: { path: string; text: string }): CodexAuth {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text) as unknown;
  } catch {
    return { kind: "blocked" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "blocked" };
  }
  const row = parsed as Record<string, unknown>;
  const mode = typeof row.auth_mode === "string" ? row.auth_mode : null;
  const tokenRow =
    row.tokens && typeof row.tokens === "object" && !Array.isArray(row.tokens)
      ? (row.tokens as Record<string, unknown>)
      : null;
  const accessToken = typeof tokenRow?.access_token === "string" ? tokenRow.access_token.trim() : "";
  const refreshRaw = typeof tokenRow?.refresh_token === "string" ? tokenRow.refresh_token.trim() : "";
  const refreshToken = refreshRaw.length > 0 ? refreshRaw : null;
  if (mode !== null && !CHATGPT_MODES.has(mode)) {
    return { kind: "blocked" };
  }
  return chatgptSession(file.path, accessToken, refreshToken, tokenRow?.account_id);
}

function chatgptSession(
  authFilePath: string,
  accessToken: string,
  refreshToken: string | null,
  accountField: unknown,
): CodexAuth {
  if (!accessToken) {
    return { kind: "blocked" };
  }
  const accountId = accountIdFromToken(accessToken, accountField);
  if (!accountId) {
    return { kind: "blocked" };
  }
  return { kind: "chatgpt", accessToken, accountId, refreshToken, authFilePath };
}

function accountIdFromToken(accessToken: string, explicit: unknown): string | null {
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }
  const payload = jwtPayload(accessToken);
  if (!payload) {
    return null;
  }
  const claim = payload[AUTH_CLAIM];
  if (claim && typeof claim === "object" && !Array.isArray(claim)) {
    const id = (claim as Record<string, unknown>).chatgpt_account_id;
    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }
  }
  const direct = payload.chatgpt_account_id;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  return null;
}

function jwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) {
    return null;
  }
  try {
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function accessTokenExpired(token: string, now = Date.now()): boolean {
  const payload = jwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return false;
  }
  return exp * 1000 <= now + 60_000;
}

async function completeCodex(
  input: {
    auth: CodexAuth;
    fetchImpl: typeof fetch;
    env: CodexProcessEnv;
    persistChatGptSession?: (session: CodexChatGptSession) => Promise<void>;
  },
  system: string,
  user: string,
): Promise<string> {
  if (input.auth.kind !== "chatgpt") {
    throw new CodexFailedError("codex_unconfigured");
  }
  let session = input.auth;
  if (session.refreshToken && accessTokenExpired(session.accessToken)) {
    session = await refreshChatGptSession(session, input.fetchImpl, input.env, input.persistChatGptSession);
  }
  const response = await postResponses(session, input.env, input.fetchImpl, system, user);
  if (response.status === 401 && session.refreshToken) {
    session = await refreshChatGptSession(session, input.fetchImpl, input.env, input.persistChatGptSession);
    const retried = await postResponses(session, input.env, input.fetchImpl, system, user);
    return readResponse(retried);
  }
  return readResponse(response);
}

async function readResponse(response: Response): Promise<string> {
  if (!response.ok) {
    throw new CodexFailedError("codex_http");
  }
  const body = await response.text();
  return readCodexResponsesText(body, response.headers.get("content-type") ?? "");
}

async function postResponses(
  session: CodexChatGptSession,
  env: CodexProcessEnv,
  fetchImpl: typeof fetch,
  system: string,
  user: string,
): Promise<Response> {
  const base = (env.CODEX_CHATGPT_BASE_URL ?? "https://chatgpt.com/backend-api/codex").replace(/\/$/, "");
  const model = env.CODEX_MODEL?.trim() || CHATGPT_MODEL;
  try {
    return await fetchImpl(`${base}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        "content-type": "application/json",
        "chatgpt-account-id": session.accountId,
        originator: CHATGPT_ORIGINATOR,
        "OpenAI-Beta": "responses=v1",
      },
      body: JSON.stringify({
        model,
        instructions: system,
        input: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: user }],
          },
        ],
        store: false,
        stream: true,
      }),
    });
  } catch {
    throw new CodexFailedError("codex_http");
  }
}

async function refreshChatGptSession(
  session: CodexChatGptSession,
  fetchImpl: typeof fetch,
  env: CodexProcessEnv,
  persist: ((session: CodexChatGptSession) => Promise<void>) | undefined,
): Promise<CodexChatGptSession> {
  if (!session.refreshToken) {
    throw new CodexFailedError("codex_auth_refresh");
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshOnce(session, fetchImpl, env, persist).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function refreshOnce(
  session: CodexChatGptSession,
  fetchImpl: typeof fetch,
  env: CodexProcessEnv,
  persist: ((session: CodexChatGptSession) => Promise<void>) | undefined,
): Promise<CodexChatGptSession> {
  const endpoint = env.CODEX_REFRESH_TOKEN_URL_OVERRIDE?.trim() || REFRESH_URL;
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: OAUTH_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      }),
    });
  } catch {
    throw new CodexFailedError("codex_auth_refresh");
  }
  if (!response.ok) {
    throw new CodexFailedError("codex_auth_refresh");
  }
  const payload = (await response.json()) as { access_token?: unknown; refresh_token?: unknown };
  const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  if (!accessToken) {
    throw new CodexFailedError("codex_auth_refresh");
  }
  const refreshToken =
    typeof payload.refresh_token === "string" && payload.refresh_token.trim()
      ? payload.refresh_token.trim()
      : session.refreshToken;
  const accountId = accountIdFromToken(accessToken, session.accountId) ?? session.accountId;
  const next: CodexChatGptSession = {
    kind: "chatgpt",
    accessToken,
    accountId,
    refreshToken,
    authFilePath: session.authFilePath,
  };
  if (persist) {
    await persist(next);
  } else {
    await persistChatGptSessionFile(next);
  }
  return next;
}

async function persistChatGptSessionFile(session: CodexChatGptSession): Promise<void> {
  if (!session.authFilePath) {
    return;
  }
  const raw = await readFile(session.authFilePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const tokens =
    parsed.tokens && typeof parsed.tokens === "object" && !Array.isArray(parsed.tokens)
      ? (parsed.tokens as Record<string, unknown>)
      : {};
  tokens.access_token = session.accessToken;
  if (session.refreshToken) {
    tokens.refresh_token = session.refreshToken;
  }
  tokens.account_id = session.accountId;
  parsed.tokens = tokens;
  parsed.last_refresh = new Date().toISOString();
  await writeFile(session.authFilePath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
}

function readSseText(body: string): string {
  let deltas = "";
  let completed = "";
  for (const block of body.split(/\n\n/)) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") {
      continue;
    }
    let event: unknown;
    try {
      event = JSON.parse(data) as unknown;
    } catch {
      throw new CodexFailedError("codex_response");
    }
    if (!event || typeof event !== "object") {
      continue;
    }
    const row = event as Record<string, unknown>;
    if (row.type === "error" || row.type === "response.failed") {
      throw new CodexFailedError("codex_http");
    }
    if (row.type === "response.output_text.delta" && typeof row.delta === "string") {
      deltas += row.delta;
    }
    if (row.type === "response.completed") {
      completed = textFromResponseObject(row.response ?? row);
    }
  }
  const text = (completed.trim() || deltas).trim();
  if (!text) {
    throw new CodexFailedError("codex_empty");
  }
  return text;
}

function textFromResponseObject(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const row = value as Record<string, unknown>;
  if (typeof row.output_text === "string") {
    return row.output_text;
  }
  if (!Array.isArray(row.output)) {
    return "";
  }
  const parts: string[] = [];
  for (const item of row.output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string" && text.length > 0) {
        parts.push(text);
      }
    }
  }
  return parts.join("");
}
