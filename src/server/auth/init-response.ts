import { errorBody, type ApiErrorCode } from "@/lib/auth/api-contract";
import { databaseUrlTargetForLog } from "../db/database-url";
import { AuthStorageInitError } from "./init-errors";

export function authInitFailureCode(error: AuthStorageInitError): ApiErrorCode {
  if (error.reason === "invalid_database_url") {
    return "misconfigured";
  }
  return "storage_unavailable";
}

export function authInitFailureStatus(): number {
  return 503;
}

export function authInitFailureBody(error: AuthStorageInitError): { ok: false; code: ApiErrorCode } {
  return errorBody(authInitFailureCode(error));
}

export function logAuthInitFailure(error: unknown, databaseUrl?: string): void {
  if (error instanceof AuthStorageInitError) {
    if (error.reason === "invalid_database_url") {
      console.error(
        "[auth] misconfigured: invalid DATABASE_URL (percent-encode # and other special characters in the password)",
      );
      return;
    }
    const target = databaseUrl ? databaseUrlTargetForLog(databaseUrl) : "(postgres)";
    console.error(`[auth] storage_unavailable: auth storage init failed for ${target}`);
    return;
  }
  console.error("[auth] storage_unavailable: unexpected auth initialization failure");
}
