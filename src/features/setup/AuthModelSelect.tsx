"use client";

import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import type { AuthModelCatalog } from "@/lib/ai-model-catalog";
import { authModelChoices, type AuthModelChoice } from "./model-choice";

const NOTE_LABELS: Readonly<Record<NonNullable<AuthModelChoice["note"]>, string>> = {
  recommended: "권장",
  "account-gated": "일부 계정",
  saved: "저장된 모델",
  unlisted: "목록에 없음",
};

/** Native Auth model select; the model ID stays visible so it matches provider documentation. */
export function AuthModelSelect({ id, value, catalog, savedModel, error, describedBy, onChangeAction }: {
  readonly id: string;
  readonly value: string;
  readonly catalog: AuthModelCatalog;
  readonly savedModel: string | null;
  readonly error?: string;
  readonly describedBy: string;
  readonly onChangeAction: (model: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChangeAction(event.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(inputClassName, "pr-8")}
    >
      {authModelChoices(catalog, value, savedModel).map((choice) => (
        <option key={choice.id} value={choice.id}>
          {choice.note ? `${choice.id} (${NOTE_LABELS[choice.note]})` : choice.id}
        </option>
      ))}
    </select>
  );
}
