import { describe, expect, test } from "bun:test";
import {
  detectLocale,
  FALLBACK_LOCALE,
  INTL_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALES,
  localeFromHeaders,
  parseAcceptLanguage,
  parseLocale,
  readLocaleCookie,
  resolveLocale,
  serializeLocaleCookie,
} from "./locale";
import { localeFromRequest } from "./server";

describe("parseLocale", () => {
  test("accepts only the supported locales, case- and whitespace-insensitively", () => {
    expect(parseLocale("ko")).toBe("ko");
    expect(parseLocale(" EN ")).toBe("en");
    for (const invalid of ["", "fr", "en-US", "ko-KR", "korean", "k o", null, undefined]) {
      expect(parseLocale(invalid)).toBeNull();
    }
    expect(isLocale("en")).toBe(true);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale(1)).toBe(false);
  });

  test("every locale has an Intl tag whose language matches", () => {
    for (const locale of LOCALES) expect(new Intl.Locale(INTL_LOCALE[locale]).language).toBe(locale);
  });
});

describe("parseAcceptLanguage", () => {
  test("orders by q, keeping header order for ties", () => {
    expect(parseAcceptLanguage("en;q=0.5, ko-KR;q=0.9, ja")).toEqual(["ja", "ko-kr", "en"]);
    expect(parseAcceptLanguage("en;q=0.8, ko;q=0.8")).toEqual(["en", "ko"]);
    expect(parseAcceptLanguage("ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7")).toEqual(["ko-kr", "ko", "en-us", "en"]);
  });

  test("drops malformed ranges, malformed q values and q=0", () => {
    expect(parseAcceptLanguage("ko;q=0, en")).toEqual(["en"]);
    expect(parseAcceptLanguage("ko;q=abc, fr;q=1.5, de;q=-1, en;q=0.3")).toEqual(["en"]);
    expect(parseAcceptLanguage("ko_KR, @@, , en-, toolonglanguage, en-GB")).toEqual(["en-gb"]);
    expect(parseAcceptLanguage("ko;q=1.000, en;q=0.999")).toEqual(["ko", "en"]);
    expect(parseAcceptLanguage(" ko ; q = 0.4 , en ; q=0.2")).toEqual(["ko", "en"]);
  });

  test("ignores non-q parameters and treats missing headers as empty", () => {
    expect(parseAcceptLanguage("en;level=1;q=0.2, ko;q=0.4")).toEqual(["ko", "en"]);
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
  });

  test("bounds the number of entries it considers", () => {
    const header = [...Array.from({ length: 40 }, () => "en;q=0.1"), "ko"].join(",");
    expect(parseAcceptLanguage(header)).toHaveLength(32);
    expect(detectLocale(header)).toBe("en");
  });
});

describe("detectLocale", () => {
  test("a Korean primary language selects ko", () => {
    expect(detectLocale("ko")).toBe("ko");
    expect(detectLocale("KO-kr,en;q=0.9")).toBe("ko");
    expect(detectLocale("en;q=0.5, ko-KR;q=0.9")).toBe("ko");
  });

  test("any other primary language selects en, even when Korean is also accepted", () => {
    expect(detectLocale("en-US,en;q=0.9,ko;q=0.8")).toBe("en");
    expect(detectLocale("ja-JP,ko;q=0.9")).toBe("en");
    expect(detectLocale("zh-Hant-TW")).toBe("en");
    expect(detectLocale("*")).toBe("en");
    expect(detectLocale("kok")).toBe("en");
  });

  test("no usable preference falls back", () => {
    expect(FALLBACK_LOCALE).toBe("en");
    expect(detectLocale(null)).toBe(FALLBACK_LOCALE);
    expect(detectLocale("")).toBe(FALLBACK_LOCALE);
    expect(detectLocale("ko;q=0")).toBe(FALLBACK_LOCALE);
    expect(detectLocale("@@@")).toBe(FALLBACK_LOCALE);
  });
});

describe("locale cookie", () => {
  test("reads the explicit choice by exact name", () => {
    expect(readLocaleCookie(`theme=dark; ${LOCALE_COOKIE}=en; other=1`)).toBe("en");
    expect(readLocaleCookie(`${LOCALE_COOKIE}=ko`)).toBe("ko");
    expect(readLocaleCookie(`x${LOCALE_COOKIE}=en; ${LOCALE_COOKIE}x=en`)).toBeNull();
    expect(readLocaleCookie("sb_session=abc")).toBeNull();
    expect(readLocaleCookie("")).toBeNull();
    expect(readLocaleCookie(null)).toBeNull();
  });

  test("invalid values are ignored and the first valid duplicate wins", () => {
    expect(readLocaleCookie(`${LOCALE_COOKIE}=fr`)).toBeNull();
    expect(readLocaleCookie(`${LOCALE_COOKIE}=`)).toBeNull();
    expect(readLocaleCookie(`${LOCALE_COOKIE}=en-US`)).toBeNull();
    expect(readLocaleCookie(`${LOCALE_COOKIE}=fr; ${LOCALE_COOKIE}=ko`)).toBe("ko");
    expect(readLocaleCookie(`${LOCALE_COOKIE}=en; ${LOCALE_COOKIE}=ko`)).toBe("en");
  });

  test("serializes a host-only, site-wide, JS-readable cookie", () => {
    const attributes = (value: string) => value.split("; ");
    const plain = attributes(serializeLocaleCookie("en", { secure: false }));
    expect(plain[0]).toBe(`${LOCALE_COOKIE}=en`);
    expect(plain.slice(1).sort()).toEqual(["Max-Age=31536000", "Path=/", "SameSite=Lax"]);
    expect(LOCALE_COOKIE_MAX_AGE).toBe(31_536_000);
    expect(attributes(serializeLocaleCookie("ko", { secure: true }))).toContain("Secure");
    for (const value of [plain, attributes(serializeLocaleCookie("ko", { secure: true }))]) {
      expect(value.some((attribute) => /^(httponly|domain)/i.test(attribute))).toBe(false);
    }
  });

  test("a serialized cookie reads back as the same locale", () => {
    for (const locale of LOCALES) {
      const pair = serializeLocaleCookie(locale, { secure: false }).split("; ")[0];
      expect(readLocaleCookie(`a=1; ${pair}`)).toBe(locale);
    }
  });
});

describe("resolveLocale", () => {
  test("an explicit cookie overrides detection in both directions", () => {
    expect(resolveLocale({ cookie: `${LOCALE_COOKIE}=en`, acceptLanguage: "ko-KR" })).toBe("en");
    expect(resolveLocale({ cookie: `${LOCALE_COOKIE}=ko`, acceptLanguage: "en-US" })).toBe("ko");
  });

  test("an invalid or absent cookie falls through to detection", () => {
    expect(resolveLocale({ cookie: `${LOCALE_COOKIE}=fr`, acceptLanguage: "ko-KR" })).toBe("ko");
    expect(resolveLocale({ cookie: null, acceptLanguage: "de-DE,ko;q=0.9" })).toBe("en");
    expect(resolveLocale({})).toBe(FALLBACK_LOCALE);
  });

  test("header adapters read only the request they are given", () => {
    const korean = new Request("http://localhost/api/x", { headers: { "accept-language": "ko-KR,ko;q=0.9" } });
    const chosen = new Request("http://localhost/api/x", {
      headers: { "accept-language": "ko-KR", cookie: `sb_session=s; ${LOCALE_COOKIE}=en` },
    });
    const english = new Headers({ "accept-language": "en-GB" });
    expect([localeFromRequest(korean), localeFromRequest(chosen), localeFromHeaders(english)]).toEqual(["ko", "en", "en"]);
    expect(localeFromRequest(korean)).toBe("ko");
  });
});
