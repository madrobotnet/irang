import type { LocalizedText } from "@/lib/i18n/locale";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

// ---------- Templates (src/server/templates, api/templates), api role ----------
export const templatesCopy = {
  notFound: t("템플릿을 찾을 수 없어요.", "Template not found."), // service.ts update/delete
  nameTaken: t("같은 이름의 템플릿이 이미 있어요.", "A template with that name already exists."), // service.ts unique name
  patchEmpty: t("바꿀 내용을 입력하세요.", "Enter something to change."), // api/templates/[id]/route.ts zod refine
} as const;
