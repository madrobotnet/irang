import { INTL_LOCALE, type Locale, type LocalizedText } from "./locale";
import { genericIssueCopy, validationFieldCopy, type IssueLike } from "./validation-copy";

/** Attach both translations to an internal schema issue without using prose as its identity. */
export function localizedIssue(text: LocalizedText) {
  return { message: text.ko, params: { localized: text } };
}

function generic(issue: IssueLike, n: (value: number | bigint | undefined) => string): LocalizedText {
  const numeric = issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint";
  const items = issue.origin === "array" || issue.origin === "set";
  switch (issue.code) {
    case "invalid_type": return genericIssueCopy.wrongType;
    case "too_small":
      if (issue.origin === "string") return issue.minimum === 1 ? genericIssueCopy.required : genericIssueCopy.minChars(n(issue.minimum));
      return numeric ? genericIssueCopy.minNumber(n(issue.minimum)) : items ? genericIssueCopy.minItems(n(issue.minimum)) : genericIssueCopy.invalid;
    case "too_big":
      if (issue.origin === "string") return genericIssueCopy.maxChars(n(issue.maximum));
      return numeric ? genericIssueCopy.maxNumber(n(issue.maximum)) : items ? genericIssueCopy.maxItems(n(issue.maximum)) : genericIssueCopy.invalid;
    case "invalid_format":
      return issue.format === "uuid" ? genericIssueCopy.badId : issue.format === "url" ? genericIssueCopy.badUrl : genericIssueCopy.badFormat;
    case "invalid_value": return genericIssueCopy.badValue;
    case "unrecognized_keys": return genericIssueCopy.unknownKeys((issue.keys ?? []).join(", "), issue.keys?.length ?? 0);
    case "invalid_union": return genericIssueCopy.noMatch;
    default: return genericIssueCopy.invalid;
  }
}

/** Locale text for one zod issue. Pass AI_FIELD_COPY only on the AI and setup routes. */
export function issueText(locale: Locale, issue: IssueLike, fields: Readonly<Record<string, LocalizedText>> = {}): string {
  if (issue.code === "custom") return (issue.params?.localized ?? genericIssueCopy.invalid)[locale];
  const key = issue.path.at(-2) === "headers"
    ? (issue.code === "invalid_key" ? "headers.name" : "headers.value")
    : String(issue.path.at(-1) ?? "");
  const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
  const n = (value: number | bigint | undefined) =>
    value === undefined ? "?" : new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
  return (field ?? generic(issue, n))[locale];
}

/** Keep field context, using the form's localized name for abbreviated query keys. */
export const issuesText = (
  locale: Locale,
  issues: readonly IssueLike[],
  fields?: Readonly<Record<string, LocalizedText>>,
): string => issues.map((issue) => {
  const path = issue.path.map(String).join(".") || "body";
  const label = Object.hasOwn(validationFieldCopy, path) ? validationFieldCopy[path]?.[locale] : undefined;
  return `${label ?? path}: ${issueText(locale, issue, fields)}`;
}).join("; ");
