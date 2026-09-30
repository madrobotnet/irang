import { ApiClientError } from "@/lib/api-client";
import type { Locale } from "./locale";

/** Render an API failure in the current locale, without keeping an old translated string in state. */
export function localizedApiError(error: unknown, locale: Locale, fallback: string): string {
  if (error instanceof ApiClientError) {
    const message = error.body?.error?.localized?.[locale];
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}
