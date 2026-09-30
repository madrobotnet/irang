import { LOCALES, type Locale, type LocalizedText } from "./locale";

/**
 * Per-feature copy catalogs. A feature keeps one `copy.ts` with a Korean source and an
 * English translation of the same shape; there is no key registry, loader or ICU layer.
 *
 * Leaves are strings or functions that return strings (for interpolation and plurals).
 * Nest plain objects for grouping; arrays are not supported, use keyed entries instead.
 */
export type CopyLeaf = string | ((...args: never[]) => string);
export type CopyTree = { readonly [key: string]: CopyLeaf | CopyTree };

/** The shape every locale must match: same keys, strings widened, same function parameters. */
export type CopyShape<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => string
      ? (...args: A) => string
      : CopyShape<T[K]>;
};

/** Korean source plus translations of the same shape; `catalog[locale]` is `T | CopyShape<T>`. */
export type CopyCatalog<T extends CopyTree> = { readonly ko: T; readonly en: CopyShape<T> };

/** Any catalog, as seen by locale-generic code such as the parity check. */
export type AnyCopyCatalog = Readonly<Record<Locale, CopyTree>>;

/**
 * Declares a catalog. Korean is the source of truth; `en` is type-checked against it,
 * so a missing key, an extra key or a changed function signature fails `tsc`.
 */
export function defineCopy<const Ko extends CopyTree>(catalog: { readonly ko: Ko; readonly en: NoInfer<CopyShape<Ko>> }): CopyCatalog<Ko> {
  return catalog;
}

/** Retain every translation for UI text that outlives the current render. */
export function textInEveryLocale(text: (locale: Locale) => string): LocalizedText {
  return { ko: text("ko"), en: text("en") };
}

/**
 * Runtime parity check for tests (catalogs built from untyped data, `as` casts, or JSON).
 * Returns machine-readable issues such as "en.form.save: missing"; an empty list means parity.
 */
export function copyParityIssues(catalog: AnyCopyCatalog): string[] {
  const issues: string[] = [];
  for (const locale of LOCALES) {
    compare(catalog.ko, catalog[locale], locale, issues, locale === "ko");
  }
  return issues;
}

function compare(source: CopyTree, target: unknown, path: string, issues: string[], isSource: boolean): void {
  if (!isPlainObject(target)) {
    issues.push(`${path}: expected object`);
    return;
  }
  for (const [key, expected] of Object.entries(source)) {
    const at = `${path}.${key}`;
    if (!Object.hasOwn(target, key)) {
      issues.push(`${at}: missing`);
      continue;
    }
    const actual = target[key];
    if (typeof expected === "string") {
      if (typeof actual !== "string") issues.push(`${at}: expected string`);
      else if (actual.trim() === "") issues.push(`${at}: empty`);
    } else if (typeof expected === "function") {
      if (typeof actual !== "function") issues.push(`${at}: expected function`);
      else if (actual.length !== expected.length) issues.push(`${at}: expected ${expected.length} parameter(s)`);
    } else {
      compare(expected, actual, at, issues, isSource);
    }
  }
  if (isSource) return;
  for (const key of Object.keys(target)) {
    if (!Object.hasOwn(source, key)) issues.push(`${path}.${key}: unexpected`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
