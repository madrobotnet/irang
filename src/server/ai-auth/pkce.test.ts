import { describe, expect, test } from "bun:test";
import { openRouterAuthorizationUrl } from "./openrouter";
import { createPkce } from "./pkce";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

describe("OpenRouter PKCE", () => {
  test("creates an S256 challenge for the generated verifier", async () => {
    const pkce = await createPkce();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pkce.verifier));

    expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.challenge).toBe(base64Url(new Uint8Array(digest)));
  });

  test("builds the fixed OpenRouter authorization URL", () => {
    const url = new URL(openRouterAuthorizationUrl({
      callbackUrl: "https://brain.example.test/auth/openrouter/callback",
      challenge: "c".repeat(43),
    }));

    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(url.searchParams.get("callback_url")).toBe(
      "https://brain.example.test/auth/openrouter/callback",
    );
    expect(url.searchParams.get("code_challenge")).toBe("c".repeat(43));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});
