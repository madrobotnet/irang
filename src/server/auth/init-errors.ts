export type AuthStorageInitReason = "invalid_database_url" | "storage_unavailable";

export class AuthStorageInitError extends Error {
  readonly reason: AuthStorageInitReason;

  constructor(reason: AuthStorageInitReason, message: string) {
    super(message);
    this.name = "AuthStorageInitError";
    this.reason = reason;
  }
}
