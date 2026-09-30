import type { LocalizedText } from "@/lib/i18n/locale";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

// ---------- Daily calendar (api/daily/calendar), zod role ----------
export const dailyCopy = {
  badMonth: t("month는 YYYY-MM 형식의 올바른 달이어야 해요.", "month must be a valid month in YYYY-MM format."), // route.ts month regex
} as const;
