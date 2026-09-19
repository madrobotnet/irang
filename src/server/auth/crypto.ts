import { createHash, randomBytes } from "crypto";
import { verify } from "argon2";
import type { PasswordVerifier, SessionTokenFactory, TokenHasher } from "./ports";

export const argon2PasswordVerifier: PasswordVerifier = {
  async verify(hash, password) {
    if (!hash || !password) {
      return false;
    }
    try {
      return await verify(hash, password);
    } catch {
      return false;
    }
  },
};

export const opaqueSessionTokens: SessionTokenFactory = {
  nextToken() {
    return randomBytes(32).toString("base64url");
  },
};

export const sha256TokenHasher: TokenHasher = {
  async hash(token) {
    return createHash("sha256").update(token, "utf8").digest("hex");
  },
};

export function tokenHashToBuffer(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}
