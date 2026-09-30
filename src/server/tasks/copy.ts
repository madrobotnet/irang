import type { LocalizedText } from "@/lib/i18n/locale";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

// ---------- Tasks (src/server/tasks, api/tasks), api role ----------
export const tasksCopy = {
  mismatch: t("그사이 할 일이 바뀌어서 체크하지 못했어요.", "The task changed in the meantime, so it wasn't updated."), // service.ts toggle, extra reason "mismatch"
  archived: t("보관한 노트의 할 일은 바꿀 수 없어요.", "Tasks in archived notes can't be changed."), // service.ts toggle, extra reason "archived"
} as const;
