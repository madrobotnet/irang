import { TypeSafeClient } from "@typesafe-ai/sdk";
import { typesafeApiKeyFromEnv } from "./env";
import type { SystemOneInvoker } from "./ports";

export class TypesafeMisconfiguredError extends Error {
  readonly code = "typesafe_misconfigured" as const;
  constructor() {
    super("TYPESAFE_API_KEY is not configured");
    this.name = "TypesafeMisconfiguredError";
  }
}

export class JudgmentFailedError extends Error {
  readonly code = "judgment_failed" as const;
  constructor(cause?: unknown) {
    super("TypeSafe judgment request failed");
    this.name = "JudgmentFailedError";
    if (cause instanceof Error && cause.message) {
      this.cause = cause;
    }
  }
}

let invokerOverride: SystemOneInvoker | null = null;

export function setSystemOneInvokerForTests(next: SystemOneInvoker | null): void {
  invokerOverride = next;
}

export function getSystemOneInvoker(): SystemOneInvoker {
  if (invokerOverride) {
    return invokerOverride;
  }
  const apiKey = typesafeApiKeyFromEnv();
  if (!apiKey) {
    throw new TypesafeMisconfiguredError();
  }
  const client = new TypeSafeClient({ apiKey });
  return {
    systemOne: (request) => client.systemOne(request),
  };
}
