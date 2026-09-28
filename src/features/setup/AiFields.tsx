"use client";

import type { Dispatch, SetStateAction } from "react";
import type { AiConnectionStatus, AiFormErrors, AiFormState, SavedAiView } from "./ai-form";
import { ChatAiFields } from "./ChatAiFields";
import { JevAiFields } from "./JevAiFields";

export type AiFieldsProps = {
  readonly value: AiFormState;
  readonly onChangeAction: Dispatch<SetStateAction<AiFormState>>;
  readonly disabled?: boolean;
  readonly saved?: SavedAiView;
  readonly connections?: readonly AiConnectionStatus[];
  readonly errors?: AiFormErrors;
  readonly idPrefix: string;
  readonly setupToken?: string;
  readonly allowDisable?: boolean;
  readonly purpose?: "chat" | "jev";
};

export function AiFields({
  value,
  onChangeAction,
  disabled = false,
  saved = null,
  connections,
  errors = {},
  idPrefix,
  setupToken,
  allowDisable = true,
  purpose,
}: AiFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {purpose !== "jev" ? (
        <ChatAiFields value={value.chat} onChangeAction={(chat) => onChangeAction((current) => ({ ...current, chat }))}
          disabled={disabled} saved={saved} connections={connections} errors={errors} idPrefix={idPrefix}
          setupToken={setupToken} allowDisable={allowDisable} />
      ) : null}
      {purpose !== "chat" ? (
        <JevAiFields value={value.jev} onChangeAction={(jev) => onChangeAction((current) => ({ ...current, jev }))}
          disabled={disabled} saved={saved} errors={errors} idPrefix={idPrefix}
          setupToken={setupToken} allowDisable={allowDisable} />
      ) : null}
    </div>
  );
}
