import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    algorithm: 2, // Argon2id; the package's ambient const enum cannot be imported with verbatimModuleSyntax.
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
}

export function verifyPassword(plain: string, encoded: string): Promise<boolean> {
  return verify(encoded, plain);
}
