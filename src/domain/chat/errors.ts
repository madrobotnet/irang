/** Raised when an assistant reply would be stored or returned with no note citation. */
export class CitationsRequiredError extends Error {
  readonly code = "citations_required" as const;
  constructor() {
    super("assistant message requires at least one note citation");
    this.name = "CitationsRequiredError";
  }
}
