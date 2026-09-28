"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, fetcher } from "@/lib/api-client";
import { AiFields } from "@/features/setup/AiFields";
import {
  aiFormFromView,
  aiSaveFailureMessage,
  buildAiInput,
  type AiFormErrors,
  type AiFormState,
  type AiSettingsResponse,
} from "@/features/setup/ai-form";
import { Section } from "./SettingsSection";
import type { ChatStatus } from "./settings-model";

const AI_SETTINGS_KEY = "/api/settings/ai";
const CHAT_STATUS_KEY = "/api/chat/status";

function ChatStatusBadge() {
  const { data, error, isLoading } = useSWR<ChatStatus>(CHAT_STATUS_KEY, fetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  if (isLoading && !data) return <Skeleton className="h-5 w-16 rounded-pill" />;
  if (error && !data) return <Badge tone="danger">확인 실패</Badge>;
  return data?.available ? <Badge tone="ok">연결 설정됨</Badge> : <Badge>설정되지 않음</Badge>;
}

export function AiConnections() {
  const { data, error, isLoading, mutate } = useSWR<AiSettingsResponse>(AI_SETTINGS_KEY, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const { mutate: mutateGlobal } = useSWRConfig();
  // Edits override the redacted server metadata; cleared after a successful save.
  const [edits, setEdits] = useState<AiFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AiFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const form = edits ?? (data ? aiFormFromView(data.settings) : null);

  const onChange = (next: AiFormState) => {
    setSavedNotice(false);
    setEdits(next);
  };

  async function onSave() {
    if (saving || !data || !form) return;
    const built = buildAiInput(form, data.settings);
    setFieldErrors(built.ok ? {} : built.errors);
    if (!built.ok) return;
    setSaving(true);
    setSaveError(null);
    setSavedNotice(false);
    try {
      const response = await api<AiSettingsResponse>(AI_SETTINGS_KEY, { method: "PUT", json: built.input });
      await mutate(response, { revalidate: false });
      setEdits(null);
      setFieldErrors({});
      setSavedNotice(true);
      // Chat availability depends on the saved connection; refresh its plain status.
      void mutateGlobal(CHAT_STATUS_KEY);
    } catch (cause) {
      // Recoverable: every field, including entered keys, stays exactly as typed.
      setSaveError(aiSaveFailureMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      id="settings-ai"
      title="AI 기능 (선택)"
      description="AI 없이도 캡처, 노트, 검색, 그래프는 모두 동작해요. 검색과 관련 노트는 AI 없이 서버에서 계산해요."
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
        ) : data && form ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-md font-medium">노트 채팅 상태</h3>
              <ChatStatusBadge />
            </div>
            <AiFields
              idPrefix="settings-ai"
              value={form}
              onChange={onChange}
              disabled={saving}
              saved={data.settings}
              connections={data.connections}
              errors={fieldErrors}
            />
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" loading={saving} disabled={saving} onClick={() => void onSave()}>
                  {saving ? "저장 중…" : "AI 설정 저장"}
                </Button>
                {savedNotice ? (
                  <p role="status" className="text-sm text-ok">
                    저장했어요. 새 설정이 바로 적용돼요.
                  </p>
                ) : null}
              </div>
              {saveError ? (
                <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
                  {saveError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
