/**
 * Locale model shared by the server (root layout, route handlers) and the client provider.
 * Pure except for the two document helpers at the bottom; nothing here holds per-request state.
 */

export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type LocalizedText = Readonly<Record<Locale, string>>;

/** Used when no explicit choice and no usable Accept-Language entry exists. */
export const FALLBACK_LOCALE: Locale = "en";

/** BCP 47 tags for Intl formatters; UI code never hardcodes "ko-KR". */
export const INTL_LOCALE: Readonly<Record<Locale, string>> = { ko: "ko-KR", en: "en-US" };

/** Explicit manual choice. Host-only, Path=/, SameSite=Lax, readable by JS (not a secret). */
export const LOCALE_COOKIE = "sb_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
/** In-tab change signal so every subscriber (useSyncExternalStore) re-reads the cookie. */
export const LOCALE_CHANGE_EVENT = "sb-locale-change";

/** Bound work on a hostile header; real browsers send well under this. */
const MAX_ACCEPT_LANGUAGE_ENTRIES = 32;
const LANGUAGE_RANGE = /^(?:\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)$/i;
const QVALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** "ko" / " EN " -> Locale; anything else (including "en-US", "fr", "") -> null. */
export function parseLocale(value: string | null | undefined): Locale | null {
  const normalized = value?.trim().toLowerCase();
  return isLocale(normalized) ? normalized : null;
}

/**
 * Accept-Language ranges ordered by preference (RFC 9110 §12.5.4): highest q first,
 * ties keep header order. Malformed ranges, malformed q values and q=0 are dropped.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  const entries: { range: string; q: number; index: number }[] = [];
  header.split(",", MAX_ACCEPT_LANGUAGE_ENTRIES).forEach((part, index) => {
    const [rawRange = "", ...params] = part.split(";").map((piece) => piece.trim());
    if (!LANGUAGE_RANGE.test(rawRange)) return;
    let q = 1;
    for (const param of params) {
      const eq = param.indexOf("=");
      if (eq < 0 || param.slice(0, eq).trim().toLowerCase() !== "q") continue;
      const value = param.slice(eq + 1).trim();
      if (!QVALUE.test(value)) return;
      q = Number(value);
    }
    if (q > 0) entries.push({ range: rawRange.toLowerCase(), q, index });
  });
  return entries.sort((a, b) => b.q - a.q || a.index - b.index).map((entry) => entry.range);
}

/** Primary (most preferred) language is Korean -> "ko"; any other primary language -> "en". */
export function detectLocale(acceptLanguage: string | null | undefined): Locale {
  const primary = parseAcceptLanguage(acceptLanguage)[0];
  if (!primary) return FALLBACK_LOCALE;
  return primary.split("-")[0] === "ko" ? "ko" : "en";
}

/** Explicit locale from a Cookie header or document.cookie; first valid sb_locale wins. */
export function readLocaleCookie(cookieHeader: string | null | undefined): Locale | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq < 0 || pair.slice(0, eq).trim() !== LOCALE_COOKIE) continue;
    const locale = parseLocale(pair.slice(eq + 1));
    if (locale) return locale;
  }
  return null;
}

/** An explicit (cookie) choice always overrides Accept-Language detection. */
export function resolveLocale(input: { cookie?: string | null; acceptLanguage?: string | null }): Locale {
  return readLocaleCookie(input.cookie) ?? detectLocale(input.acceptLanguage);
}

/** Request-local resolution from any Headers-like object (Request.headers, next/headers). */
export function localeFromHeaders(headers: Pick<Headers, "get">): Locale {
  return resolveLocale({ cookie: headers.get("cookie"), acceptLanguage: headers.get("accept-language") });
}

/** document.cookie assignment string for an explicit choice. */
export function serializeLocaleCookie(locale: Locale, options: { secure: boolean }): string {
  const attributes = [`${LOCALE_COOKIE}=${locale}`, "Path=/", `Max-Age=${LOCALE_COOKIE_MAX_AGE}`, "SameSite=Lax"];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

/** Browser only: the persisted explicit choice, or null when following detection. */
export function readDocumentLocale(): Locale | null {
  try {
    return readLocaleCookie(document.cookie);
  } catch {
    return null;
  }
}

/**
 * Browser only: persist an explicit choice and notify subscribers in this tab.
 * Returns false when the browser refused the cookie (blocked cookies, sandboxed frame).
 */
export function writeDocumentLocale(locale: Locale): boolean {
  let persisted = false;
  try {
    document.cookie = serializeLocaleCookie(locale, { secure: window.location.protocol === "https:" });
    persisted = readLocaleCookie(document.cookie) === locale;
  } catch {
    // Cookie access denied: the provider still applies the choice in this tab.
  }
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  return persisted;
}
