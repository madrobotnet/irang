import type {
  AiSettingsInput,
  AiSettingsView,
  ConnectionProfileInput,
  ConnectionProfileView,
} from "@/lib/ai-settings";
import {
  buildChatConnection,
  buildJevConnection,
  chatFormFromView,
  emptyChatForm,
  emptyJevForm,
  jevFormFromView,
} from "@/features/setup/connection-form";
import {
  mergeConnectionErrors,
  type AiFormErrors,
  type AiFormState,
} from "@/features/setup/ai-form";

export type ProfilePurpose = "chat" | "jev";

export function newProfileForm(purpose: ProfilePurpose): AiFormState {
  return {
    chat: { ...emptyChatForm(), enabled: purpose === "chat" },
    jev: { ...emptyJevForm(), enabled: purpose === "jev" },
  };
}

export function profileFormFromView(profile: ConnectionProfileView): AiFormState {
  switch (profile.purpose) {
    case "chat":
      return {
        chat: chatFormFromView(profile.connection, profile.name),
        jev: emptyJevForm(),
      };
    case "jev":
      return {
        chat: emptyChatForm(),
        jev: jevFormFromView(profile.connection, profile.name),
      };
  }
}

export type ProfileBuildResult =
  | { readonly ok: true; readonly input: ConnectionProfileInput }
  | { readonly ok: false; readonly errors: AiFormErrors };

export function buildProfileInput(
  purpose: ProfilePurpose,
  state: AiFormState,
  saved: ConnectionProfileView | null,
): ProfileBuildResult {
  const errors: AiFormErrors = {};
  if (purpose === "chat") {
    const name = state.chat.name.trim();
    if (!name) errors["chat.name"] = "nameRequired";
    const built = buildChatConnection(state.chat, saved?.purpose === "chat" ? saved.connection : null);
    if (!built.ok) {
      mergeConnectionErrors(errors, "chat", built.errors);
    }
    if (Object.keys(errors).length > 0 || !built.ok) return { ok: false, errors };
    return {
      ok: true,
      input: { purpose: "chat", name, connection: built.connection, consent: true },
    };
  }
  const name = state.jev.name.trim();
  if (!name) errors["jev.name"] = "nameRequired";
  const built = buildJevConnection(state.jev, saved?.purpose === "jev" ? saved.connection : null);
  if (!built.ok) {
    mergeConnectionErrors(errors, "jev", built.errors);
  }
  if (Object.keys(errors).length > 0 || !built.ok) return { ok: false, errors };
  return {
    ok: true,
    input: { purpose: "jev", name, connection: built.connection, consent: true },
  };
}

export type SelectionValue = "off" | "environment" | string;
export type SelectionState = {
  readonly chat: SelectionValue;
  readonly jev: SelectionValue;
  readonly chatConsent: boolean;
  readonly jevConsent: boolean;
};

export function selectionFromView(view: AiSettingsView): SelectionState {
  return {
    chat: view.chatManagedByEnvironment ? "environment" : view.chatId ?? "off",
    jev: view.jevManagedByEnvironment ? "environment" : view.jevId ?? "off",
    chatConsent: view.chat !== null,
    jevConsent: view.jev !== null,
  };
}

export function buildSelectionInput(state: SelectionState): AiSettingsInput {
  const selection = (value: SelectionValue) => {
    if (value === "off") return null;
    if (value === "environment") return { mode: "environment" } as const;
    return { mode: "saved", id: value } as const;
  };
  return {
    chat: selection(state.chat),
    chatConsent: state.chat === "off" ? false : state.chatConsent,
    jev: selection(state.jev),
    jevConsent: state.jev === "off" ? false : state.jevConsent,
  };
}
