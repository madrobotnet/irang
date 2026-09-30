"use client";

import { Check, Merge, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import useSWR from "swr";
import { useCopy, useLocale } from "@/components/i18n";
import { Badge, Button, cn, Dialog, Input } from "@/components/ui";
import { api, fetcher } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import type { InboxItem, Note, NoteTitleMatch } from "@/lib/types";
import { INBOX_COPY } from "./inbox-copy";
import { mergeBlock, mergeOptions } from "./inbox-triage";

/** `edited` is true when the triage draft changed; the merge still appends the stored capture. */
export type MergeTarget = { item: InboxItem; edited: boolean };

const SEARCH_DELAY_MS = 150;

export function MergeDialog({
  target,
  onOpenChange,
  onMerged,
}: {
  target: MergeTarget | null;
  onOpenChange: (open: boolean) => void;
  onMerged: (item: InboxItem, note: Note) => void;
}) {
  const copy = useCopy(INBOX_COPY);
  const { locale } = useLocale();
  const formId = useId();
  const listId = useId();
  const previewId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [seen, setSeen] = useState<MergeTarget | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // A new target (the dialog reopened) starts with an empty search.
  if (seen !== target) {
    setSeen(target);
    setQuery("");
    setSearch("");
    setChosenId(null);
    setBusy(false);
    setError(null);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const results = useSWR<{ notes: NoteTitleMatch[] }>(
    target ? `/api/notes/titles?q=${encodeURIComponent(search)}&limit=8` : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const suggestions = target?.item.suggestions;
  const suggestion = suggestions?.status === "ready" ? suggestions.duplicateOf : null;
  const options = mergeOptions(results.data?.notes ?? [], suggestion, search);
  const active = options.find((option) => option.id === chosenId) ?? options[0] ?? null;
  const optionId = (id: string) => `${listId}-${id}`;

  const move = (delta: number) => {
    if (!options.length) return;
    const index = active ? options.findIndex((option) => option.id === active.id) : -1;
    const next = options[Math.min(options.length - 1, Math.max(0, index + delta))]!;
    setChosenId(next.id);
    setError(null);
    document.getElementById(optionId(next.id))?.scrollIntoView({ block: "nearest" });
  };

  const merge = async () => {
    if (!target || !active || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { note } = await api<{ note: Note }>(`/api/inbox/${target.item.id}/merge`, { method: "POST", json: { noteId: active.id } });
      onMerged(target.item, note);
    } catch (cause) {
      setError(cause);
      setBusy(false);
    }
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      // keyCode 229 covers Safari, which ends Korean composition before this keydown.
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      void merge();
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onOpenChange(false);
      }}
      title={copy.merge.title}
      description={copy.merge.description}
      initialFocusRef={inputRef}
      dismissible={!busy}
      footer={
        <>
          <Button disabled={busy} onClick={() => onOpenChange(false)}>{copy.merge.cancel}</Button>
          <Button type="submit" form={formId} variant="primary" loading={busy} disabled={!active} leading={<Merge aria-hidden className="size-4" />}>
            {copy.merge.confirm}
          </Button>
        </>
      }
    >
      {target ? (
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-4 pb-1"
          onSubmit={(event) => {
            event.preventDefault();
            void merge();
          }}
        >
          <div className="flex flex-col gap-2">
            <Input
              ref={inputRef}
              label={copy.merge.searchLabel}
              leading={<Search aria-hidden />}
              value={query}
              placeholder={copy.merge.searchPlaceholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setError(null);
              }}
              onKeyDown={onSearchKeyDown}
              readOnly={busy}
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active ? optionId(active.id) : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <ul id={listId} role="listbox" aria-label={copy.merge.resultsLabel} className={cn("max-h-60 overflow-y-auto rounded-card border border-line p-1 scrollbar-thin", !options.length && "hidden")}>
              {options.map((option) => {
                const selected = option.id === active?.id;
                return (
                  <li
                    key={option.id}
                    id={optionId(option.id)}
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setChosenId(option.id);
                      setError(null);
                      inputRef.current?.focus();
                    }}
                    className={cn("flex min-h-touch cursor-pointer items-center gap-3 rounded-ctl px-3 py-2", selected ? "bg-accent-soft" : "hover:bg-line/50")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{option.title}</span>
                      {option.matchedAlias ? <span className="block truncate text-xs text-mute">{copy.merge.alias(option.matchedAlias)}</span> : null}
                    </span>
                    {option.suggested ? <Badge tone="accent" className="shrink-0">{copy.merge.suggested}</Badge> : null}
                    <Check aria-hidden className={cn("size-4 shrink-0 text-accent", !selected && "invisible")} />
                  </li>
                );
              })}
            </ul>
            {results.error ? (
              <p role="alert" className="text-sm text-danger">{localizedApiError(results.error, locale, copy.merge.searchFailed)}</p>
            ) : !results.data && !options.length ? (
              <p role="status" className="px-1 text-sm text-mute">{copy.merge.searching}</p>
            ) : !options.length ? (
              <p role="status" className="px-1 text-sm text-mute">{copy.merge.noResults}</p>
            ) : null}
          </div>

          <section aria-labelledby={previewId}>
            <h3 id={previewId} className="text-sm font-medium text-ink">{copy.merge.previewLabel}</h3>
            <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap break-words rounded-ctl border border-line bg-desk px-3 py-2 text-sm leading-relaxed text-ink">
              {mergeBlock(target.item)}
            </p>
            {target.edited ? <p className="mt-1.5 text-xs text-warn">{copy.merge.editedHint}</p> : null}
          </section>

          {error ? (
            <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
              {localizedApiError(error, locale, copy.merge.failed)}
            </p>
          ) : null}
        </form>
      ) : null}
    </Dialog>
  );
}
