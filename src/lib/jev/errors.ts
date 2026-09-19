export type JevClientErrorCode =
  | "missing_api_key"
  | "seat_not_wired"
  | "request_failed";

export class JevClientError extends Error {
  readonly code: JevClientErrorCode;
  readonly cause?: unknown;

  constructor(code: JevClientErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "JevClientError";
    this.code = code;
    this.cause = cause;
  }
}
