import { describe, expect, test } from "bun:test";
import { OAuthCredentialSchema, WebAuthProviderSchema } from "./ai-auth";

describe("OAuth credential schemas", () => {
  test("accepts every supported web authentication provider", () => {
    expect(WebAuthProviderSchema.options).toEqual(["github-copilot", "openrouter", "xai"]);
  });

  test("requires renewable provider credentials to carry refresh tokens", () => {
    expect(OAuthCredentialSchema.safeParse({
      provider: "github-copilot",
      accessToken: "copilot-token",
    }).success).toBe(false);
    expect(OAuthCredentialSchema.safeParse({
      provider: "xai",
      accessToken: "xai-token",
    }).success).toBe(false);
  });

  test("accepts Copilot HTTPS account endpoints and rejects embedded credentials", () => {
    const credential = {
      provider: "github-copilot", accessToken: "copilot-token", refreshToken: "github-token",
    };
    expect(OAuthCredentialSchema.safeParse({
      ...credential, baseUrl: "https://api.business.githubcopilot.com",
    }).success).toBe(true);
    for (const baseUrl of ["ftp://host.test", "https://user:secret@host.test", "https://host.test?token=secret"]) {
      expect(OAuthCredentialSchema.safeParse({ ...credential, baseUrl }).success).toBe(false);
    }
  });

  test("keeps an OpenRouter durable key distinct from refreshable credentials", () => {
    expect(OAuthCredentialSchema.parse({
      provider: "openrouter",
      accessToken: "openrouter-key",
    })).toEqual({
      provider: "openrouter",
      accessToken: "openrouter-key",
    });
    expect(OAuthCredentialSchema.safeParse({
      provider: "openrouter",
      accessToken: "openrouter-key",
      refreshToken: "not-supported",
    }).success).toBe(false);
  });
});
