import type { LocalizedText } from "@/lib/i18n/locale";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

export const validationFieldCopy: Readonly<Record<string, LocalizedText>> = {
  q: t("검색어", "Search terms"),
};

/** Structural subset of zod v4 core.$ZodIssue; every real issue is assignable. */
export type IssueLike = {
  readonly code?: string;
  readonly message: string;
  readonly params?: { readonly localized?: LocalizedText };
  readonly path: readonly PropertyKey[];
  readonly origin?: string;
  readonly minimum?: number | bigint;
  readonly maximum?: number | bigint;
  readonly format?: string;
  readonly keys?: readonly string[];
};

// zod issue codes: invalid_type, too_small, too_big, invalid_format,
// invalid_value, unrecognized_keys, invalid_union, then everything else.
export const genericIssueCopy = {
  required: t("값을 입력하세요.", "Enter a value."),
  wrongType: t("값이 없거나 형식이 올바르지 않아요.", "This value is missing or has the wrong type."),
  minChars: (n: string) => t(`${n}자 이상 입력하세요.`, `Enter at least ${n} characters.`),
  maxChars: (n: string) => t(`${n}자 이하로 입력하세요.`, `Use ${n} characters or fewer.`),
  minNumber: (n: string) => t(`${n} 이상이어야 해요.`, `Must be ${n} or more.`),
  maxNumber: (n: string) => t(`${n} 이하여야 해요.`, `Must be ${n} or less.`),
  minItems: (n: string) => t(`${n}개 이상 필요해요.`, `Add at least ${n}.`),
  maxItems: (n: string) => t(`${n}개까지 입력할 수 있어요.`, `You can add up to ${n}.`),
  badId: t("올바른 ID가 아니에요.", "That isn't a valid ID."),
  badUrl: t("올바른 URL을 입력하세요.", "Enter a valid URL."),
  badFormat: t("형식이 올바르지 않아요.", "The format isn't valid."),
  badValue: t("허용하지 않는 값이에요.", "That value isn't allowed."),
  unknownKeys: (keys: string, count: number) =>
    t(`알 수 없는 항목: ${keys}`, `Unknown field${count === 1 ? "" : "s"}: ${keys}`),
  noMatch: t("입력 형식이 올바르지 않아요.", "The input doesn't match any accepted format."),
  invalid: t("값이 올바르지 않아요.", "That value isn't valid."),
} as const;
