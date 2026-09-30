import { describe, expect, test } from "bun:test";
import type { WebAuthProvider } from "@/lib/ai-auth";
import type { AuthAttemptView } from "@/lib/ai-auth-flow";
import { ApiClientError } from "@/lib/api-client";
import { LOCALES } from "@/lib/i18n/locale";
import { AI_COPY } from "./ai-copy";
import {
  attemptError,
  AuthAttemptController,
  authPanelErrorText,
  awaitingAuthCode,
  type AuthRequest,
  type AuthTimers,
} from "./auth-attempt";

const ID = "123e4567-e89b-42d3-a456-426614174020";
const NEXT_ID = "123e4567-e89b-42d3-a456-426614174021";
const TOKEN = "s".repeat(40);

type Call = {
  readonly method?: string;
  readonly path: string;
  readonly json: unknown;
  readonly signal?: AbortSignal;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
};

const view = (patch: Partial<AuthAttemptView> = {}): AuthAttemptView => ({
  id: ID, provider: "google", status: "pending", expiresAt: 1,
  verificationUrl: "https://accounts.google.com/o/oauth2/v2/auth", requiresCode: true, retryAfterMs: 2_000,
  ...patch,
});
const ready = (patch: Partial<AuthAttemptView> = {}): AuthAttemptView => ({
  id: ID, provider: "google", status: "ready", expiresAt: 1, ...patch,
});

/**
 * `setupToken: null` models authenticated settings, which send no installer token.
 * `deleteError` makes every cleanup request fail with it; otherwise cleanups succeed.
 */
function harness(provider: WebAuthProvider = "google", setupToken: string | null = TOKEN, deleteError?: unknown) {
  const calls: Call[] = [];
  const waiters: { readonly index: number; readonly resolve: (call: Call) => void }[] = [];
  const request: AuthRequest = <T,>(path: string, init: RequestInit & { json?: unknown }) => new Promise<T>((resolve, reject) => {
    const call = {
      method: init.method, path, json: init.json, signal: init.signal ?? undefined,
      resolve: (value: unknown) => resolve(value as T), reject,
    };
    calls.push(call);
    for (const waiter of waiters.filter((entry) => entry.index === calls.length - 1)) waiter.resolve(call);
    // Cleanup requests succeed unless a test says otherwise; their outcome is asserted via `calls`.
    if (init.method === "DELETE") {
      if (deleteError === undefined) call.resolve({ ok: true });
      else call.reject(deleteError);
    }
  });
  /** Resolves when the request with this index is issued, for flows that make it after internal awaits. */
  const waitForCall = (index: number) => new Promise<Call>((resolve, reject) => {
    const existing = calls[index];
    if (existing) return resolve(existing);
    const timer = setTimeout(() => reject(new Error(`Request ${index} was never issued`)), 1_000);
    waiters.push({ index, resolve: (call) => { clearTimeout(timer); resolve(call); } });
  });
  const scheduled = new Map<number, { readonly run: () => Promise<void>; readonly ms: number }>();
  let handle = 0;
  const timers: AuthTimers = {
    set: (run, ms) => {
      handle += 1;
      scheduled.set(handle, { run, ms });
      return handle;
    },
    clear: (id) => {
      scheduled.delete(id);
    },
  };
  const readiness: (string | undefined)[] = [];
  const controller = new AuthAttemptController({ provider, setupToken: setupToken ?? undefined, request, timers });
  controller.setReadyHandler((attemptId) => readiness.push(attemptId));
  const firePoll = () => {
    const entries = [...scheduled];
    const entry = entries[0];
    if (!entry || entries.length !== 1) throw new Error(`Expected one scheduled poll, found ${entries.length}`);
    scheduled.delete(entry[0]);
    return { ms: entry[1].ms, settled: entry[1].run() };
  };
  const start = async (response: AuthAttemptView) => {
    const started = controller.start();
    calls.at(-1)?.resolve(response);
    await started;
  };
  const routes = () => calls.map((call) => `${call.method} ${call.path}`);
  return { controller, calls, scheduled, readiness, firePoll, start, routes, waitForCall };
}

describe("Google authorization-code login", () => {
  test("does not poll while the pasted code is still needed", async () => {
    const qa = harness();
    await qa.start(view());

    expect(qa.calls[0]?.json).toEqual({ provider: "google", setupToken: TOKEN });
    expect(awaitingAuthCode(qa.controller.getSnapshot().attempt)).toBe(true);
    expect(qa.scheduled.size).toBe(0);
    expect(qa.readiness).toEqual([undefined]);
  });

  test("submits the trimmed code once, clears it, and keeps polling a retryable exchange until ready", async () => {
    const qa = harness();
    await qa.start(view());
    qa.controller.setCode("  4/0Abc-DEF_ghi  ");

    const submitted = qa.controller.submitCode();
    const duplicate = qa.controller.submitCode();
    expect(qa.controller.getSnapshot().submitting).toBe(true);
    expect(qa.routes()).toEqual(["POST /api/ai/auth", `POST /api/ai/auth/${ID}/code`]);
    expect(qa.calls[1]?.json).toEqual({ code: "4/0Abc-DEF_ghi", setupToken: TOKEN });

    qa.calls[1]?.resolve(view({ requiresCode: false, retryAfterMs: 5_000 }));
    await Promise.all([submitted, duplicate]);
    expect(qa.controller.getSnapshot()).toMatchObject({ code: "", submitting: false, codeError: null, error: null });

    let poll = qa.firePoll();
    expect(poll.ms).toBe(5_000);
    expect(qa.calls[2]).toMatchObject({ method: "POST", path: `/api/ai/auth/${ID}`, json: { setupToken: TOKEN } });
    qa.calls[2]?.resolve(view({ requiresCode: false, retryAfterMs: 10_000 }));
    await poll.settled;

    poll = qa.firePoll();
    expect(poll.ms).toBe(10_000);
    qa.calls[3]?.resolve(ready());
    await poll.settled;

    expect(qa.readiness).toEqual([undefined, ID]);
    expect(qa.controller.getSnapshot().attempt?.status).toBe("ready");
    expect(qa.scheduled.size).toBe(0);
  });

  test("keeps the code after a transient failure and lets an explicit status check find a delivered code", async () => {
    const qa = harness();
    await qa.start(view());
    qa.controller.setCode("4/0Abc");

    const submitted = qa.controller.submitCode();
    const lost = new TypeError("fetch failed");
    qa.calls[1]?.reject(lost);
    await submitted;
    expect(qa.controller.getSnapshot()).toMatchObject({ code: "4/0Abc", submitting: false, error: { key: "codeSendFailed", cause: lost } });
    expect(qa.scheduled.size).toBe(0);

    qa.controller.retryStatus();
    expect(qa.controller.getSnapshot().error).toBeNull();
    const poll = qa.firePoll();
    qa.calls[2]?.resolve(view({ requiresCode: false }));
    await poll.settled;

    expect(qa.routes().at(-1)).toBe(`POST /api/ai/auth/${ID}`);
    expect(qa.controller.getSnapshot().code).toBe("");
    expect(qa.scheduled.size).toBe(1);
  });

  test("asks for a new code when the server still needs one after submission", async () => {
    const qa = harness();
    await qa.start(view());
    qa.controller.setCode("4/0Expired");

    const submitted = qa.controller.submitCode();
    qa.calls[1]?.resolve(view());
    await submitted;

    const snapshot = qa.controller.getSnapshot();
    expect(snapshot.code).toBe("");
    expect(snapshot.codeError).toBe("rejected");
    expect(awaitingAuthCode(snapshot.attempt)).toBe(true);
    expect(qa.scheduled.size).toBe(0);
  });

  test("rejects empty input and a pasted callback URL without sending them", async () => {
    const qa = harness();
    await qa.start(view());

    qa.controller.setCode("   ");
    await qa.controller.submitCode();
    expect(qa.controller.getSnapshot().codeError).toBe("missing");

    qa.controller.setCode("https://codeassist.google.com/authcode?code=4/0Abc");
    expect(qa.controller.getSnapshot().codeError).toBeNull();
    await qa.controller.submitCode();

    expect(qa.controller.getSnapshot()).toMatchObject({ code: "https://codeassist.google.com/authcode?code=4/0Abc", submitting: false });
    expect(qa.controller.getSnapshot().codeError).toBe("format");
    expect(qa.routes()).toEqual(["POST /api/ai/auth"]);
  });

  test("never attaches a ready reply that arrives after cancellation", async () => {
    const qa = harness();
    await qa.start(view());
    qa.controller.setCode("4/0Abc");
    const submitted = qa.controller.submitCode();

    await qa.controller.cancel();
    expect(qa.controller.getSnapshot()).toMatchObject({ attempt: null, code: "", submitting: false, error: null });
    expect(qa.calls[2]).toMatchObject({ method: "DELETE", path: `/api/ai/auth/${ID}`, json: { setupToken: TOKEN } });

    qa.calls[1]?.resolve(ready());
    await submitted;

    expect(qa.readiness).toEqual([undefined, undefined]);
    expect(qa.controller.getSnapshot().attempt).toBeNull();
    expect(qa.scheduled.size).toBe(0);
  });

  test("abandons and ignores an in-flight exchange when the provider scope is released", async () => {
    const qa = harness();
    await qa.start(view());
    qa.controller.setCode("4/0Abc");
    const submitted = qa.controller.submitCode();

    qa.controller.release();
    expect(qa.controller.getSnapshot()).toMatchObject({ attempt: null, code: "", submitting: false });
    expect(qa.calls[2]).toMatchObject({ method: "DELETE", path: `/api/ai/auth/${ID}`, json: { setupToken: TOKEN } });

    qa.calls[1]?.resolve(ready());
    await submitted;

    expect(qa.readiness).toEqual([undefined]);
    expect(qa.controller.getSnapshot().attempt).toBeNull();
  });
});

describe("device and shared login lifecycle", () => {
  test("polls an OpenAI device code on the server interval and reports ready", async () => {
    const qa = harness("openai", null);
    await qa.start(view({ provider: "openai", requiresCode: undefined, userCode: "ABCD-1234", retryAfterMs: 5_000,
      verificationUrl: "https://auth.openai.com/codex/device" }));

    expect(qa.calls[0]?.json).toEqual({ provider: "openai" });
    const poll = qa.firePoll();
    expect(poll.ms).toBe(5_000);
    expect(qa.calls[1]?.json).toEqual({});
    qa.calls[1]?.resolve(ready({ provider: "openai" }));
    await poll.settled;

    expect(qa.readiness).toEqual([undefined, ID]);
  });

  test("aborts and ignores a poll reply that lands after cancellation", async () => {
    const qa = harness("openai", null);
    await qa.start(view({ provider: "openai", requiresCode: undefined, userCode: "ABCD-1234" }));
    const poll = qa.firePoll();
    const inFlight = qa.calls[1];

    await qa.controller.cancel();
    expect(inFlight?.signal?.aborted).toBe(true);
    inFlight?.resolve(ready({ provider: "openai" }));
    await poll.settled;

    expect(qa.readiness).toEqual([undefined, undefined]);
    expect(qa.controller.getSnapshot().attempt).toBeNull();
    expect(qa.routes().at(-1)).toBe(`DELETE /api/ai/auth/${ID}`);
  });

  test("stops polling after a transient status failure until the user retries", async () => {
    const qa = harness("xai", null);
    await qa.start(view({ provider: "xai", requiresCode: undefined, userCode: "WXYZ" }));
    let poll = qa.firePoll();
    const busy = new ApiClientError(503, "unavailable", "detail");
    qa.calls[1]?.reject(busy);
    await poll.settled;

    expect(qa.controller.getSnapshot().error).toEqual({ key: "statusFailed", cause: busy });
    expect(qa.scheduled.size).toBe(0);

    qa.controller.retryStatus();
    poll = qa.firePoll();
    qa.calls[2]?.resolve(view({ provider: "xai", requiresCode: undefined, userCode: "WXYZ" }));
    await poll.settled;
    expect(qa.controller.getSnapshot().error).toBeNull();
    expect(qa.scheduled.size).toBe(1);
  });

  test("abandons a start reply that arrives after the scope changed, and can start again afterwards", async () => {
    const qa = harness();
    const started = qa.controller.start();
    qa.controller.release();
    qa.calls[0]?.resolve(view());
    await started;

    expect(qa.routes()).toEqual(["POST /api/ai/auth", `DELETE /api/ai/auth/${ID}`]);
    expect(qa.controller.getSnapshot()).toMatchObject({ attempt: null, starting: false });

    await qa.start(view({ id: NEXT_ID }));
    expect(qa.controller.getSnapshot().attempt?.id).toBe(NEXT_ID);
  });

  test("a restart that fails after deleting the previous attempt does not restore it, and the next start begins fresh", async () => {
    const qa = harness("xai", null);
    await qa.start(view({ provider: "xai", requiresCode: undefined, userCode: "WXYZ" }));
    const restarted = qa.controller.start();
    // The previous attempt is abandoned before the new start request is issued.
    const startCall = await qa.waitForCall(2);
    const conflict = new ApiClientError(409, "conflict", "detail");
    startCall.reject(conflict);
    await restarted;

    expect(qa.routes()).toEqual(["POST /api/ai/auth", `DELETE /api/ai/auth/${ID}`, "POST /api/ai/auth"]);
    expect(qa.controller.getSnapshot()).toMatchObject({
      starting: false, error: { key: "startFailed", cause: conflict }, attempt: null,
    });
    expect(qa.scheduled.size).toBe(0);

    await qa.start(view({ id: NEXT_ID, provider: "xai", requiresCode: undefined, userCode: "ABCD" }));
    expect(qa.routes().slice(3)).toEqual(["POST /api/ai/auth"]);
    expect(qa.controller.getSnapshot()).toMatchObject({ error: null, attempt: { id: NEXT_ID, status: "pending" } });
  });

  test("a restart that cannot delete the previous attempt keeps it visible as failed and retries the cleanup next time", async () => {
    const outage = new ApiClientError(503, "unavailable", "detail");
    const qa = harness("xai", null, outage);
    await qa.start(view({ provider: "xai", requiresCode: undefined, userCode: "WXYZ" }));
    await qa.controller.start();

    expect(qa.routes()).toEqual(["POST /api/ai/auth", `DELETE /api/ai/auth/${ID}`]);
    expect(qa.controller.getSnapshot()).toMatchObject({
      starting: false, error: { key: "startFailed", cause: outage }, attempt: { id: ID, status: "failed" },
    });
    expect(qa.scheduled.size).toBe(0);

    await qa.controller.start();
    expect(qa.routes().slice(2)).toEqual([`DELETE /api/ai/auth/${ID}`]);
  });

  test("a previous attempt the server already removed does not block a restart", async () => {
    const qa = harness("xai", null, new ApiClientError(404, "not_found", "gone"));
    await qa.start(view({ provider: "xai", requiresCode: undefined, userCode: "WXYZ" }));
    const restarted = qa.controller.start();
    const startCall = await qa.waitForCall(2);
    startCall.resolve(view({ id: NEXT_ID, provider: "xai", requiresCode: undefined, userCode: "ABCD" }));
    await restarted;

    expect(qa.routes()).toEqual(["POST /api/ai/auth", `DELETE /api/ai/auth/${ID}`, "POST /api/ai/auth"]);
    expect(qa.controller.getSnapshot()).toMatchObject({ error: null, attempt: { id: NEXT_ID, status: "pending" } });
  });

  test("an invalid installer code blocks the start without clearing a ready login", async () => {
    const qa = harness("google", "too-short");
    await qa.controller.start();

    expect(qa.calls).toHaveLength(0);
    expect(qa.readiness).toEqual([]);
    expect(qa.controller.getSnapshot().error).toEqual({ key: "needSetupToken" });
  });
});

describe("auth panel errors are reasons rendered in the current locale", () => {
  test("terminal attempt states map to reasons, with Google's own restart guidance", () => {
    expect(attemptError("denied")).toEqual({ key: "denied" });
    expect(attemptError("expired")).toEqual({ key: "expired" });
    expect(attemptError("failed", "google")).toEqual({ key: "googleFailed" });
    expect(attemptError("failed", "openai")).toEqual({ key: "failed" });
    expect(attemptError("pending")).toBeNull();
    expect(attemptError("ready")).toBeNull();
  });

  test("a retained failure shows the server's localized text, otherwise the reason's own copy", () => {
    const localized = { ko: "ko-marker", en: "en-marker" };
    const explained = new ApiClientError(409, "conflict", localized.en, { error: { code: "conflict", message: localized.en, localized } });
    for (const locale of LOCALES) {
      const copy = AI_COPY[locale].auth.errors;
      expect(authPanelErrorText({ key: "startFailed", cause: explained }, locale)).toBe(localized[locale]);
      expect(authPanelErrorText({ key: "statusFailed", cause: new Error("raw provider text") }, locale)).toBe(copy.statusFailed);
      expect(authPanelErrorText({ key: "needSetupToken" }, locale)).toBe(copy.needSetupToken);
    }
  });
});
