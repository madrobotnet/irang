import { expect, test } from "bun:test";
import { AuthCodeInputSchema } from "@/lib/ai-auth-flow";
import { exchangeGoogleCode, googleAuthorizationUrl } from "./google";
import { exchangeOpenAiCode, pollOpenAiDeviceAuthorization, refreshOpenAiCredential, startOpenAiDeviceAuthorization } from "./openai";

function jwt(payload: unknown): string {
  return `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.fixture`;
}

async function wire(responses: Response[], run: (fetchImpl: typeof fetch, requests: { url: string; body: string; headers: Headers }[]) => Promise<void>) {
  const requests: { url: string; body: string; headers: Headers }[] = [];
  const server = Bun.serve({ port: 0, async fetch(request) {
    requests.push({ url: request.headers.get("x-fixture-url") ?? "", body: await request.text(), headers: request.headers });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected OAuth request");
    return response;
  } });
  const fetchImpl: typeof fetch = Object.assign((url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("x-fixture-url", String(url));
    return fetch(server.url, { ...init, headers });
  }, { preconnect: fetch.preconnect });
  try { await run(fetchImpl, requests); } finally { await server.stop(true); }
}

test("OpenAI exchanges the official device grant as a form and resolves account identity from id_token", async () => {
  // Given: the access token deliberately has no account claim.
  const accessToken = jwt({ exp: 3601 });
  await wire([
    Response.json({ device_auth_id: "private-device", usercode: "REAL-CODE", interval: "7" }),
    Response.json({ authorization_code: "private-code", code_verifier: "private-verifier", code_challenge: "challenge" }),
    Response.json({ access_token: accessToken, refresh_token: "private-refresh",
      id_token: jwt({ "https://api.openai.com/auth": { chatgpt_account_id: "account-from-id" } }) }),
  ], async (fetchImpl, requests) => {
    // When
    const options = { fetchImpl, now: () => 1000 };
    const started = await startOpenAiDeviceAuthorization(options);
    const result = await pollOpenAiDeviceAuthorization(started, options);
    if (result.status !== "code") throw new Error("Expected authorization code");
    const credential = await exchangeOpenAiCode(result.code, options);
    // Then
    expect(started).toMatchObject({ userCode: "REAL-CODE", verificationUrl: "https://auth.openai.com/codex/device", intervalSeconds: 7, expiresAt: 901000 });
    expect(credential).toEqual({ provider: "openai", accessToken, refreshToken: "private-refresh", accountId: "account-from-id", expiresAt: 3601000 });
    expect(requests.map((request) => request.url)).toEqual([
      "https://auth.openai.com/api/accounts/deviceauth/usercode", "https://auth.openai.com/api/accounts/deviceauth/token", "https://auth.openai.com/oauth/token",
    ]);
    expect(JSON.parse(requests[1]?.body ?? "")).toEqual({ device_auth_id: "private-device", user_code: "REAL-CODE" });
    expect(requests[2]?.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(requests[2]?.body))).toEqual({
      client_id: "app_EMoamEEZ73f0CkXaXp7hrann", grant_type: "authorization_code", code: "private-code",
      code_verifier: "private-verifier", redirect_uri: "https://auth.openai.com/deviceauth/callback",
    });
  });
});

test.each([403, 404])("OpenAI treats HTTP %i with an empty body as pending", async (status) => {
  // Given
  await wire([new Response(null, { status })], async (fetchImpl) => {
    // When / Then
    expect(await pollOpenAiDeviceAuthorization({ deviceCode: "device", userCode: "user" }, { fetchImpl })).toEqual({ status: "pending" });
  });
});

test.each(["authorization_declined", { code: "authorization_declined" }])("OpenAI distinguishes authorization denial from pending", async (error) => {
  // Given
  await wire([Response.json({ error }, { status: 401 })], async (fetchImpl) => {
    // When / Then
    expect(await pollOpenAiDeviceAuthorization({ deviceCode: "device", userCode: "user" }, { fetchImpl })).toEqual({ status: "denied" });
  });
});

test("OpenAI refresh retains account and refresh grant when the response omits them", async () => {
  // Given
  await wire([Response.json({ access_token: "new-access", expires_in: 3600 })], async (fetchImpl, requests) => {
    // When
    const result = await refreshOpenAiCredential({ provider: "openai", accessToken: "old", refreshToken: "rotate", accountId: "account", expiresAt: 0 }, { fetchImpl, now: () => 1000 });
    // Then
    expect(result).toEqual({ provider: "openai", accessToken: "new-access", refreshToken: "rotate", accountId: "account", expiresAt: 3601000 });
    expect(JSON.parse(requests[0]?.body ?? "")).toMatchObject({ grant_type: "refresh_token", refresh_token: "rotate" });
  });
});

test("Google uses Gemini's manual PKCE redirect and cloud-platform scope, not device authorization", async () => {
  // Given
  await wire([Response.json({ access_token: "google-access", refresh_token: "google-refresh", expires_in: 3600, token_type: "Bearer" })], async (fetchImpl, requests) => {
    // When
    const url = new URL(googleAuthorizationUrl("fixture-challenge"));
    const result = await exchangeGoogleCode({ code: "4/fixture-code", verifier: "fixture-verifier" }, { fetchImpl, now: () => 1000 });
    // Then
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe("https://codeassist.google.com/authcode");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([
      "https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile",
    ]);
    expect(url.searchParams.get("code_challenge")).toBe("fixture-challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toMatch(/^[a-f0-9]{64}$/);
    expect(result).toMatchObject({ provider: "google", accessToken: "google-access", refreshToken: "google-refresh", expiresAt: 3601000 });
    expect(requests[0]?.url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(requests[0]?.body);
    expect(body.get("code")).toBe("4/fixture-code");
    expect(body.get("code_verifier")).toBe("fixture-verifier");
    expect(body.get("redirect_uri")).toBe("https://codeassist.google.com/authcode");
    expect(body.get("client_id")).toBe(url.searchParams.get("client_id"));
  });
});

test("manual-code input accepts code text and rejects callback URLs and injected fields", () => {
  // Given / When / Then
  expect(AuthCodeInputSchema.parse({ code: " 4/0Ab_C-D " })).toEqual({ code: "4/0Ab_C-D" });
  for (const code of ["https://example.test?code=secret", "code=secret", "code secret", ""]) {
    expect(AuthCodeInputSchema.safeParse({ code }).success).toBe(false);
  }
  expect(AuthCodeInputSchema.safeParse({ code: "4/code", redirectUri: "https://attacker.test" }).success).toBe(false);
});
