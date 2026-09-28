"use client";

import { Eraser, Inbox, Link2, Save } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { Button, Dialog, Input, Textarea, useToast } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { InboxItem } from "@/lib/types";
import { INBOX_KEY, type InboxListData, withItem } from "@/features/inbox/inbox-triage";
import { buildCapturePayload, EMPTY_DRAFT, isDraftEmpty, type CaptureDraft } from "./capture-form";

/**
 * CONTRACT (owned by the inbox lane): quick-capture dialog.
 * The shell renders <CaptureDialog open onOpenChange /> and opens it from the
 * capture button, the command palette, and the "c" / Ctrl+Shift+Space shortcut.
 */
export type CaptureDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function CaptureDialog({ open, onOpenChange }: CaptureDialogProps) {
  const [draft, setDraft] = useState<CaptureDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<"text" | "url" | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const revisionRef = useRef(0);
  const { mutate } = useSWRConfig();
  const { toast } = useToast();

  const update = (field: keyof CaptureDraft, value: string) => {
    revisionRef.current += 1;
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const clear = () => {
    if (!isDraftEmpty(draft) && !window.confirm("작성 중인 캡처를 지울까요? 이 작업은 되돌릴 수 없습니다.")) return;
    revisionRef.current += 1;
    setDraft(EMPTY_DRAFT);
    setErrors({});
    textRef.current?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const built = buildCapturePayload(draft);
    if (!built.ok) {
      setErrors({ [built.field]: built.message });
      return;
    }
    const submittedRevision = revisionRef.current;
    setSaving(true);
    setErrors({});
    try {
      const { item } = await api<{ item: InboxItem }>("/api/capture", { method: "POST", json: built.payload });
      void mutate(INBOX_KEY, (current: InboxListData | undefined) => withItem(current, item), { revalidate: true });
      void mutate("/api/home");
      const draftUnchanged = revisionRef.current === submittedRevision;
      if (draftUnchanged) {
        revisionRef.current += 1;
        setDraft(EMPTY_DRAFT);
        onOpenChange(false);
      }
      toast(draftUnchanged ? "인박스에 저장했습니다." : "인박스에 저장했습니다. 새 입력은 그대로 두었습니다.", { tone: "ok" });
    } catch (cause) {
      setErrors({ form: cause instanceof Error ? cause.message : "저장하지 못했습니다. 입력은 그대로 보관했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="빠른 캡처"
      description="지금 적고, 분류는 인박스에서 나중에 하세요."
      initialFocusRef={textRef}
      footer={
        <>
          {!isDraftEmpty(draft) ? (
            <Button variant="ghost" leading={<Eraser aria-hidden className="size-4" />} disabled={saving} onClick={clear} className="mr-auto">
              입력 지우기
            </Button>
          ) : null}
          <Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button variant="primary" loading={saving} leading={<Save aria-hidden className="size-4" />} onClick={() => textRef.current?.form?.requestSubmit()}>
            인박스에 저장
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Textarea
          ref={textRef}
          label="내용"
          rows={7}
          value={draft.text}
          onChange={(event) => update("text", event.target.value)}
          placeholder="떠오른 생각, 할 일, 인용할 문장을 적어 보세요. URL만 붙여 넣어도 됩니다."
          error={errors.text}
          disabled={saving}
          className="min-h-36"
        />
        <Input
          label="원문 URL (선택)"
          type="url"
          inputMode="url"
          value={draft.url}
          onChange={(event) => update("url", event.target.value)}
          placeholder="https://example.com/article"
          error={errors.url}
          disabled={saving}
          leading={<Link2 aria-hidden />}
        />
        <Input
          label="제목 (선택)"
          value={draft.title}
          onChange={(event) => update("title", event.target.value)}
          placeholder="비워 두면 내용에서 자동으로 정합니다."
          disabled={saving}
          leading={<Inbox aria-hidden />}
        />
        {errors.form ? (
          <p role="alert" className="rounded-ctl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
