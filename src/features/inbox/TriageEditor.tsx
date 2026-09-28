"use client";

import { AlertTriangle, ArrowUpRight, Check, ExternalLink, Lightbulb, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { Badge, Button, Input, TagBadge, Textarea } from "@/components/ui";
import type { InboxItem } from "@/lib/types";
import { formatCreated, mergeTags, percent, SOURCE_LABEL, stripUrlStatus, suggestionView, syncTriageDraft, urlStatus } from "./inbox-triage";

type EditorProps = {
  item: InboxItem;
  titleRef: RefObject<HTMLInputElement | null>;
  busy: "promote" | "discard" | "suggest" | null;
  onPromote: (item: InboxItem, draft: { title: string; body: string; tags: string[] }) => Promise<void>;
  onDiscard: () => void;
  onSuggest: (item: InboxItem) => Promise<void>;
};

export function TriageEditor({ item, titleRef, busy, onPromote, onDiscard, onSuggest }: EditorProps) {
  const incomingBody = stripUrlStatus(item.body);
  const [edit, setEdit] = useState(() => ({
    title: item.title,
    body: incomingBody,
    sourceTitle: item.title,
    sourceBody: incomingBody,
    titleDirty: false,
    bodyDirty: false,
  }));
  const [manualTags, setManualTags] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set());
  const suggestions = suggestionView(item.suggestions);
  const status = urlStatus(item.body);
  const tags = mergeTags(manualTags, selectedTags);

  // Background URL/suggestion refreshes may update the item. Adopt server text
  // only while that field is pristine, so a late response never replaces typing.
  if (edit.sourceTitle !== item.title || edit.sourceBody !== incomingBody) {
    setEdit((current) => syncTriageDraft(current, item.title, incomingBody));
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const onFormKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <form
      className="surface-card min-w-0 p-4 sm:p-5"
      onKeyDown={onFormKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        void onPromote(item, { title: edit.title.trim(), body: edit.body, tags });
      }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <Badge>{SOURCE_LABEL[item.source]}</Badge>
        <span className="text-xs text-mute">{formatCreated(item.createdAt)}</span>
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex min-h-touch items-center gap-1 text-sm font-medium text-accent hover:underline">
            원문 열기 <ExternalLink aria-hidden className="size-3.5" />
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <Input
          ref={titleRef}
          label="노트 제목"
          value={edit.title}
          onChange={(event) => setEdit((current) => ({ ...current, title: event.target.value, titleDirty: true }))}
          disabled={busy !== null}
          required
        />
        <Textarea
          label="본문"
          rows={11}
          value={edit.body}
          onChange={(event) => setEdit((current) => ({ ...current, body: event.target.value, bodyDirty: true }))}
          disabled={busy !== null}
          className="min-h-52"
        />
        {status ? (
          <div className={`flex items-start gap-2 rounded-ctl border px-3 py-2 text-sm ${status === "pending" ? "border-warn/30 bg-warn-soft text-warn" : "border-danger/30 bg-danger-soft text-danger"}`}>
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {status === "pending" ? "원문 내용을 가져오는 중입니다. 지금 승격하면 현재 본문만 저장됩니다." : "원문 내용을 가져오지 못했습니다. 링크는 노트에 보존됩니다."}
          </div>
        ) : null}

        <section aria-labelledby={`suggestions-${item.id}`} className="rounded-card border border-line bg-desk/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id={`suggestions-${item.id}`} className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles aria-hidden className="size-4 text-accent" /> 정리 제안
              </h2>
              <p className="mt-1 text-xs text-mute">제안은 선택해야만 노트에 적용됩니다.</p>
            </div>
            {suggestions.kind !== "ready" ? (
              <Button size="sm" loading={busy === "suggest"} disabled={busy !== null} onClick={() => void onSuggest(item)}>
                다시 확인
              </Button>
            ) : null}
          </div>
          {suggestions.kind === "pending" ? <p className="mt-3 text-sm text-mute">아직 제안이 준비되지 않았습니다.</p> : null}
          {suggestions.kind === "unavailable" ? <p className="mt-3 text-sm text-mute">AI가 설정되지 않아 제안을 만들 수 없습니다. 캡처와 승격은 그대로 사용할 수 있습니다.</p> : null}
          {suggestions.kind === "failed" ? <p className="mt-3 text-sm text-danger">제안을 만드는 데 실패했습니다. 직접 정리하거나 다시 시도하세요.</p> : null}
          {suggestions.kind === "ready" ? (
            <div className="mt-3 flex flex-col gap-3">
              {suggestions.suggestions.tags.length ? (
                <div className="flex flex-wrap gap-2">
                  {suggestions.suggestions.tags.map(({ tag, probability }) => {
                    const checked = selectedTags.has(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleTag(tag)}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-ctl border px-2.5 text-sm focus-ring ${checked ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-ink"}`}
                      >
                        {checked ? <Check aria-hidden className="size-3.5" /> : null}#{tag} <span className="text-xs text-mute">{percent(probability)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-mute">추천할 태그가 없습니다.</p>}
              {suggestions.suggestions.kind ? (
                <p className="flex items-center gap-2 text-sm"><Lightbulb aria-hidden className="size-4 text-mute" />분류 제안: <strong>{suggestions.suggestions.kind.choice}</strong> <span className="text-mute">{percent(suggestions.suggestions.kind.confidence)}</span></p>
              ) : null}
              {suggestions.suggestions.duplicateOf ? (
                <p className="text-sm text-warn">
                  비슷한 기존 노트: <Link className="font-medium underline" href={`/notes/${suggestions.suggestions.duplicateOf.noteId}`}>{suggestions.suggestions.duplicateOf.title}</Link> ({percent(suggestions.suggestions.duplicateOf.probability)})
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <Input label="태그 (선택)" value={manualTags} onChange={(event) => setManualTags(event.target.value)} placeholder="쉼표로 구분하세요." disabled={busy !== null} />
        {tags.length ? <div className="flex flex-wrap gap-1.5" aria-label="적용할 태그">{tags.map((tag) => <TagBadge key={tag} tag={tag} />)}</div> : null}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="danger" size="lg" leading={<Trash2 aria-hidden className="size-4" />} disabled={busy !== null} onClick={onDiscard}>
          버리기
        </Button>
        <Button data-promote={item.id} type="submit" variant="primary" size="lg" loading={busy === "promote"} disabled={busy !== null} leading={<ArrowUpRight aria-hidden className="size-4" />}>
          노트로 만들고 열기
        </Button>
      </div>
    </form>
  );
}
