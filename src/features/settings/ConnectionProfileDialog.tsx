"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { api } from "@/lib/api-client";
import type { AiSettingsView, ConnectionProfileView } from "@/lib/ai-settings";
import { AiFields } from "@/features/setup/AiFields";
import { abandonAuthAttempt } from "@/features/setup/AiAuthPanel";
import { aiSaveFailureMessage, type AiConnectionStatus, type AiFormErrors } from "@/features/setup/ai-form";
import {
  buildProfileInput,
  newProfileForm,
  profileFormFromView,
  type ProfilePurpose,
} from "./profile-form";

type ProfileResponse = {
  readonly profile: ConnectionProfileView;
  readonly settings: AiSettingsView;
};

function savedView(profile: ConnectionProfileView | null): AiSettingsView | null {
  if (!profile) return null;
  return {
    chat: profile.purpose === "chat" ? profile.connection : null,
    jev: profile.purpose === "jev" ? profile.connection : null,
    profiles: [profile],
    chatId: profile.purpose === "chat" ? profile.id : null,
    jevId: profile.purpose === "jev" ? profile.id : null,
    chatManagedByEnvironment: false,
    jevManagedByEnvironment: false,
  };
}

export function ConnectionProfileDialog({
  open,
  purpose,
  profile,
  connections,
  onOpenChangeAction,
  onSavedAction,
}: {
  readonly open: boolean;
  readonly purpose: ProfilePurpose;
  readonly profile: ConnectionProfileView | null;
  readonly connections: readonly AiConnectionStatus[];
  readonly onOpenChangeAction: (open: boolean) => void;
  readonly onSavedAction: (response: ProfileResponse) => void;
}) {
  const [form, setForm] = useState(() => profile ? profileFormFromView(profile) : newProfileForm(purpose));
  const [errors, setErrors] = useState<AiFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    const attemptId = purpose === "chat" ? form.chat.authAttemptId : form.jev.authAttemptId;
    if (attemptId) {
      void abandonAuthAttempt(attemptId, {})
        .catch(() => console.warn("Provider login cleanup failed; the attempt will expire."));
    }
    onOpenChangeAction(false);
  };

  const save = async () => {
    if (saving) return;
    const built = buildProfileInput(purpose, form, profile);
    setErrors(built.ok ? {} : built.errors);
    if (!built.ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      const path = profile
        ? `/api/settings/ai/connections/${profile.id}`
        : "/api/settings/ai/connections";
      const response = await api<ProfileResponse>(path, {
        method: profile ? "PUT" : "POST",
        json: built.input,
      });
      onSavedAction(response);
    } catch (cause) {
      setSaveError(aiSaveFailureMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      dismissible={!saving}
      onOpenChange={(next) => next ? onOpenChangeAction(true) : close()}
      size="lg"
      title={profile ? "AI 연결 편집" : purpose === "chat" ? "채팅 연결 추가" : "Jev 연결 추가"}
      description={profile
        ? "사용 중인 연결의 변경은 저장 즉시 적용돼요. 사용하지 않는 연결은 별도로 선택해야 해요."
        : "저장해도 바로 사용되지는 않아요. 목록에서 이 연결을 선택한 뒤 사용 설정을 저장하세요."}
      bodyClassName="px-3 sm:px-5"
      footer={
        <>
          <Button size="lg" disabled={saving} onClick={close}>취소</Button>
          <Button variant="primary" size="lg" loading={saving} onClick={() => void save()}>
            {saving ? "저장 중…" : "연결 저장"}
          </Button>
        </>
      }
    >
      <AiFields
        idPrefix={`profile-${purpose}`}
        value={form}
        onChangeAction={setForm}
        disabled={saving}
        saved={savedView(profile)}
        connections={connections}
        errors={errors}
        allowDisable={false}
        purpose={purpose}
      />
      {saveError ? (
        <p role="alert" className="mt-3 rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
          {saveError}
        </p>
      ) : null}
    </Dialog>
  );
}
