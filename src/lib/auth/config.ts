import { z } from "zod";

const authEnvironment = z.object({
  BRAIN_GATE_PASSWORD: z.string().refine((value) => value.trim().length > 0),
  BRAIN_COOKIE_SECURE: z.enum(["true", "false"]).default("true"),
  BRAIN_TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});

export class AuthMisconfiguredError extends Error {
  readonly name = "AuthMisconfiguredError";

  constructor() {
    super("Auth environment is missing or invalid");
  }
}

export type AuthConfig = {
  readonly gatePassword: string;
  readonly cookieSecure: boolean;
  readonly trustProxy: boolean;
};

export function readAuthConfig(): AuthConfig {
  const config = authEnvironment.safeParse(process.env).data;
  if (config === undefined) throw new AuthMisconfiguredError();
  return {
    gatePassword: config.BRAIN_GATE_PASSWORD,
    cookieSecure: config.BRAIN_COOKIE_SECURE === "true",
    trustProxy: config.BRAIN_TRUST_PROXY === "true",
  };
}
