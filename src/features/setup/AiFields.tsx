"use client";

import type { AiConnectionStatus, AiFormErrors, AiFormState, SavedAiView } from "./ai-form";
import { ChatAiFields } from "./ChatAiFields";
import { JevAiFields } from "./JevAiFields";

export type AiFieldsProps = {
  readonly value: AiFormState;
  readonly onChange: (next: AiFormState) => void;
  readonly disabled?: boolean;
  readonly saved?: SavedAiView;
  readonly connections?: readonly AiConnectionStatus[];
  readonly errors?: AiFormErrors;
  readonly idPrefix: string;
};

export function AiFields({ value, onChange, disabled = false, saved = null, connections, errors = {}, idPrefix }: AiFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <ChatAiFields value={value.chat} onChange={(chat) => onChange({ ...value, chat })}
        disabled={disabled} saved={saved} connections={connections} errors={errors} idPrefix={idPrefix} />
      <JevAiFields value={value.jev} onChange={(jev) => onChange({ ...value, jev })}
        disabled={disabled} saved={saved} errors={errors} idPrefix={idPrefix} />
    </div>
  );
}
