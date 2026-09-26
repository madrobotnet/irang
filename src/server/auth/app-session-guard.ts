import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import type { SessionRecord } from "@/domain/auth/types";
import { AuthStorageInitError } from "./init-errors";
import { getAuthRuntime } from "./runtime";

export type AppSessionGateResult =
  | { kind: "ok"; session: SessionRecord }
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "misconfigured" };

/** In-process session gate for App Router pages (no HTTP self-fetch). */
export async function resolveAppSessionGate(): Promise<AppSessionGateResult> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
  if (!token) {
    return { kind: "missing" };
  }
  try {
    const { service } = await getAuthRuntime();
    const session = await service.lookup(token);
    if (!session) {
      return { kind: "invalid" };
    }
    return { kind: "ok", session };
  } catch (error) {
    if (error instanceof AuthStorageInitError) {
      return { kind: "misconfigured" };
    }
    return { kind: "invalid" };
  }
}
