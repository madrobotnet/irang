"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, fetcher } from "@/lib/api-client";
import type { AiSettingsView, ConnectionProfileView } from "@/lib/ai-settings";
import {
  aiSaveFailureMessage,
  type AiSettingsResponse,
} from "@/features/setup/ai-form";
import { Section } from "./SettingsSection";
import { ConnectionProfileDialog } from "./ConnectionProfileDialog";
import { AiPurposeSection } from "./AiPurposeSection";
import {
  buildSelectionInput,
  selectionFromView,
  type ProfilePurpose,
  type SelectionState,
  type SelectionValue,
} from "./profile-form";
import type { ChatStatus } from "./settings-model";

const AI_SETTINGS_KEY = "/api/settings/ai";
const CHAT_STATUS_KEY = "/api/chat/status";

function ChatStatusBadge() {
  const { data, error, isLoading } = useSWR<ChatStatus>(CHAT_STATUS_KEY, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  if (isLoading && !data) return <Skeleton className="h-5 w-16 rounded-pill" />;
  if (error && !data) return <Badge tone="danger">확인 실패</Badge>;
  return data?.available ? <Badge tone="ok">연결 설정됨</Badge> : <Badge>설정되지 않음</Badge>;
}

type EditorState = {
  readonly purpose: ProfilePurpose;
  readonly profile: ConnectionProfileView | null;
};

export function AiConnections() {
  const { data, error, isLoading, mutate } = useSWR<AiSettingsResponse>(AI_SETTINGS_KEY, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const { mutate: mutateGlobal } = useSWRConfig();
  const [selectionEdits, setSelectionEdits] = useState<SelectionState | null>(null);
  const [selectionErrors, setSelectionErrors] = useState<{ readonly chat?: string; readonly jev?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleting, setDeleting] = useState<ConnectionProfileView | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selection = selectionEdits ?? (data ? selectionFromView(data.settings) : null);

  const setChoice = (purpose: ProfilePurpose, value: SelectionValue) => {
    if (!selection) return;
    setSavedNotice(false);
    setSelectionErrors({});
    setSelectionEdits({
      ...selection,
      [purpose]: value,
      [`${purpose}Consent`]: value === "off",
    });
  };

  const saveSelection = async () => {
    if (!data || !selection || saving) return;
    const errors = {
      ...(selection.chat !== "off" && !selection.chatConsent ? { chat: "채팅 데이터 전송에 동의해 주세요." } : {}),
      ...(selection.jev !== "off" && !selection.jevConsent ? { jev: "Jev 데이터 전송에 동의해 주세요." } : {}),
    };
    setSelectionErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    setSavedNotice(false);
    try {
      const response = await api<AiSettingsResponse>(AI_SETTINGS_KEY, {
        method: "PUT",
        json: buildSelectionInput(selection),
      });
      await mutate(response, { revalidate: false });
      setSelectionEdits(null);
      setSavedNotice(true);
      void mutateGlobal(CHAT_STATUS_KEY);
    } catch (cause) {
      setSaveError(aiSaveFailureMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const removeProfile = async () => {
    if (!data || !deleting || deleteBusy) return;
    const deletedId = deleting.id;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await api<{ readonly settings: AiSettingsView }>(
        `/api/settings/ai/connections/${deletedId}`,
        { method: "DELETE" },
      );
      await mutate({ settings: response.settings, connections: data.connections }, { revalidate: false });
      setSelectionEdits((current) => {
        if (!current) return null;
        const saved = selectionFromView(response.settings);
        return {
          chat: current.chat === deletedId ? saved.chat : current.chat,
          chatConsent: current.chat === deletedId ? saved.chatConsent : current.chatConsent,
          jev: current.jev === deletedId ? saved.jev : current.jev,
          jevConsent: current.jev === deletedId ? saved.jevConsent : current.jevConsent,
        };
      });
      setDeleting(null);
      void mutateGlobal(CHAT_STATUS_KEY);
    } catch (cause) {
      setDeleteError(aiSaveFailureMessage(cause));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Section
      id="settings-ai"
      title="AI 기능 (선택)"
      description="채팅과 인박스 정리는 서로 다른 연결을 사용할 수 있어요. 연결을 저장하는 것과 실제 사용 여부는 별도로 관리돼요."
    >
      <div className="surface-card px-4 py-4 sm:px-5 sm:py-5">
        {isLoading && !data ? (
          <div aria-label="AI 설정을 불러오는 중" className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error && !data ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-md font-medium text-danger">AI 설정을 불러오지 못했습니다.</p>
            <p className="text-sm text-mute">{error instanceof Error && error.message ? error.message : "네트워크 상태를 확인해 주세요."}</p>
            <Button size="lg" leading={<RefreshCw aria-hidden className="size-4" />} onClick={() => void mutate()}>
              다시 불러오기
            </Button>
          </div>
        ) : data && selection ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-md font-medium">노트 채팅 상태</h3>
              <ChatStatusBadge />
            </div>
            <AiPurposeSection
              purpose="chat"
              title="노트 채팅"
              value={selection.chat}
              activeId={data.settings.chatId}
              consent={selection.chatConsent}
              profiles={data.settings.profiles.filter((profile) => profile.purpose === "chat")}
              error={selectionErrors.chat}
              disabled={saving}
              onValueChangeAction={(value) => setChoice("chat", value)}
              onConsentChangeAction={(chatConsent) => {
                setSavedNotice(false);
                setSelectionEdits({ ...selection, chatConsent });
              }}
              onAddAction={() => setEditor({ purpose: "chat", profile: null })}
              onEditAction={(profile) => setEditor({ purpose: "chat", profile })}
              onDeleteAction={setDeleting}
            />
            <AiPurposeSection
              purpose="jev"
              title="인박스 정리 (Jev)"
              value={selection.jev}
              activeId={data.settings.jevId}
              consent={selection.jevConsent}
              profiles={data.settings.profiles.filter((profile) => profile.purpose === "jev")}
              error={selectionErrors.jev}
              disabled={saving}
              onValueChangeAction={(value) => setChoice("jev", value)}
              onConsentChangeAction={(jevConsent) => {
                setSavedNotice(false);
                setSelectionEdits({ ...selection, jevConsent });
              }}
              onAddAction={() => setEditor({ purpose: "jev", profile: null })}
              onEditAction={(profile) => setEditor({ purpose: "jev", profile })}
              onDeleteAction={setDeleting}
            />
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" loading={saving} onClick={() => void saveSelection()}>
                  {saving ? "저장 중…" : "사용 설정 저장"}
                </Button>
                {savedNotice ? <p role="status" className="text-sm text-ok">저장했어요. 새 선택이 바로 적용돼요.</p> : null}
              </div>
              {saveError ? <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">{saveError}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
      {editor && data ? (
        <ConnectionProfileDialog
          key={`${editor.purpose}:${editor.profile?.id ?? "new"}`}
          open
          purpose={editor.purpose}
          profile={editor.profile}
          connections={data.connections}
          onOpenChangeAction={(open) => {
            if (!open) setEditor(null);
          }}
          onSavedAction={(response) => {
            void mutate({ settings: response.settings, connections: data.connections }, { revalidate: false });
            void mutateGlobal(CHAT_STATUS_KEY);
            setEditor(null);
          }}
        />
      ) : null}
      <Dialog
        open={Boolean(deleting)}
        dismissible={!deleteBusy}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        size="sm"
        title="저장된 연결을 삭제할까요?"
        description="삭제한 키와 로그인 정보는 복구할 수 없어요. 이 연결을 사용 중이면 해당 AI 기능도 꺼져요."
        footer={
          <>
            <Button size="lg" disabled={deleteBusy} onClick={() => setDeleting(null)}>취소</Button>
            <Button variant="danger" size="lg" loading={deleteBusy} onClick={() => void removeProfile()}>연결 삭제</Button>
          </>
        }
      >
        {deleteError ? <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">{deleteError}</p> : null}
      </Dialog>
    </Section>
  );
}
