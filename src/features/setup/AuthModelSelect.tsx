"use client";

import { useCopy } from "@/components/i18n";
import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import type { AuthModelCatalog } from "@/lib/ai-model-catalog";
import { AI_COPY } from "./ai-copy";
import { authModelChoices } from "./model-choice";

/** Native Auth model select; the model ID stays visible so it matches provider documentation. */
export function AuthModelSelect({ id, value, catalog, savedModel, invalid, describedBy, onChangeAction }: {
  readonly id: string;
  readonly value: string;
  readonly catalog: AuthModelCatalog;
  readonly savedModel: string | null;
  readonly invalid?: boolean;
  readonly describedBy: string;
  readonly onChangeAction: (model: string) => void;
}) {
  const notes = useCopy(AI_COPY).modelNotes;
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChangeAction(event.target.value)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      className={cn(inputClassName, "pr-8")}
    >
      {authModelChoices(catalog, value, savedModel).map((choice) => (
        <option key={choice.id} value={choice.id}>
          {choice.note ? `${choice.id} (${notes[choice.note]})` : choice.id}
        </option>
      ))}
    </select>
  );
}
