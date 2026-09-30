"use client";

import { Command } from "cmdk";
import { CalendarDays, FileText, LoaderCircle, Monitor, Moon, Plus, Search, Sun, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type RefObject } from "react";
import useSWR, { useSWRConfig } from "swr";
import { localDateKey } from "@/features/home/home-model";
import { refreshNoteViews } from "@/features/notes/note-cache";
import { api } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import type { NoteRef } from "@/lib/types";
import { useCopy } from "@/components/i18n/LocaleProvider";
import { useModalDialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { useToast } from "@/components/ui/Toast";
import { keywordsInEveryLocale, SHELL_COPY } from "./copy";
import { NAV_ITEMS } from "./nav";
import { modKey } from "./shortcuts";
import { useTheme } from "./ThemeProvider";

/** "all" = commands + notes (⌘K); "notes" = note switcher only (⌘P). */
export type PaletteMode = "all" | "notes";

export type CommandPaletteProps = {
  open: boolean;
  mode: PaletteMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: PaletteMode) => void;
  /** Injected by ShellProvider; kept optional so the palette can render standalone. */
  onCapture?: () => void;
};

const NOTE_LIMIT = 12;

export function CommandPalette({ open, mode, onOpenChange, onModeChange, onCapture }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ref, onClose, onBackdropClick } = useModalDialog(open, onOpenChange, inputRef);
  const copy = useCopy(SHELL_COPY);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={onBackdropClick}
      aria-label={mode === "notes" ? copy.palette.switcherLabel : copy.actions.palette}
      className="mx-auto mb-auto mt-[10dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-card border border-line bg-card p-0 text-ink shadow-pop backdrop:bg-scrim sm:mt-[14dvh]"
    >
      {open ? <PaletteBody mode={mode} onOpenChange={onOpenChange} onModeChange={onModeChange} onCapture={onCapture} inputRef={inputRef} /> : null}
    </dialog>
  );
}

type PaletteBodyProps = Omit<CommandPaletteProps, "open"> & { inputRef: RefObject<HTMLInputElement | null> };

/** Mounted only while open, so query/busy state starts fresh on every open. */
function PaletteBody({ mode, onOpenChange, onModeChange, onCapture, inputRef }: PaletteBodyProps) {
  const router = useRouter();
  const { cache, mutate } = useSWRConfig();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const copy = useCopy(SHELL_COPY);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const trimmed = query.trim();
  const notes = useSWR<{ notes: NoteRef[] }>(`/api/notes/titles?q=${encodeURIComponent(trimmed)}&limit=${NOTE_LIMIT}`, {
    revalidateOnFocus: false,
  });
  const noteList = useMemo(() => notes.data?.notes ?? [], [notes.data]);
  const noteTitles = useMemo(() => new Set(noteList.map((n) => n.title.toLowerCase())), [noteList]);
  const canCreate = trimmed.length > 0 && !notes.isValidating && !notes.error && !noteTitles.has(trimmed.toLowerCase());
  const mod = modKey();

  const run = (fn: () => void | Promise<void>) => {
    void (async () => {
      setBusy(true);
      try {
        await fn();
        onOpenChange(false);
      } catch (error) {
        toast(textInEveryLocale((locale) => localizedApiError(error, locale, SHELL_COPY[locale].palette.failed)), { tone: "danger" });
      } finally {
        setBusy(false);
      }
    })();
  };

  const go = (href: string) => run(() => router.push(href));
  const createNote = (title?: string) =>
    run(async () => {
      const { note } = await api<{ note: NoteRef }>("/api/notes", { method: "POST", json: title ? { title } : {} });
      await refreshNoteViews({ cache, mutate });
      router.push(`/notes/${note.id}`);
    });
  const openDaily = () =>
    run(async () => {
      const { note } = await api<{ note: NoteRef }>("/api/daily", { method: "POST", json: { date: localDateKey(new Date()) } });
      await refreshNoteViews({ cache, mutate });
      router.push(`/notes/${note.id}`);
    });

  return (
    <Command
      label={mode === "notes" ? copy.palette.switcherLabel : copy.actions.palette}
      loop
      shouldFilter={mode === "all"}
      filter={(value, search, keywords) => {
        const hay = [value, ...(keywords ?? [])].join(" ").toLowerCase();
        const needle = search.trim().toLowerCase();
        if (!needle) return 1;
        return hay.includes(needle) ? 1 : 0;
      }}
      className="flex max-h-[min(70dvh,32rem)] flex-col"
    >
      <div className="flex items-center gap-2 border-b border-line px-3">
        {busy || notes.isValidating ? (
          <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-mute" />
        ) : (
          <Search aria-hidden className="size-4 shrink-0 text-mute" />
        )}
        <Command.Input
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder={mode === "notes" ? copy.palette.switcherPlaceholder : copy.palette.placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-mute"
        />
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {mode === "all" ? (
            <button type="button" onClick={() => onModeChange("notes")} className="rounded-ctl px-1.5 py-0.5 text-xs text-mute hover:bg-line/60 hover:text-ink">
              {copy.palette.notesOnly}
            </button>
          ) : (
            <button type="button" onClick={() => onModeChange("all")} className="rounded-ctl px-1.5 py-0.5 text-xs text-mute hover:bg-line/60 hover:text-ink">
              {copy.palette.all}
            </button>
          )}
          <Kbd>esc</Kbd>
        </div>
      </div>

      <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5 scrollbar-thin">
        <Command.Empty className="px-3 py-8 text-center text-sm text-mute">
          {notes.isValidating ? copy.palette.searching : notes.error ? copy.palette.loadFailed : copy.palette.empty}
        </Command.Empty>

        {mode === "all" ? (
          <Command.Group heading={copy.palette.groups.actions} className={GROUP}>
            <Command.Item
              value="capture"
              keywords={[...keywordsInEveryLocale((c) => c.actions.capture, (c) => c.palette.keywords.capture), "c"]}
              onSelect={() => run(() => onCapture?.())}
              className={ITEM}
            >
              <Zap aria-hidden className={ICON} />
              <span className="flex-1">{copy.actions.capture}</span>
              <Hint keys={["c"]} />
            </Command.Item>
            <Command.Item
              value="new-note"
              keywords={keywordsInEveryLocale((c) => c.palette.newNote, (c) => c.palette.keywords.newNote)}
              onSelect={() => createNote()}
              className={ITEM}
            >
              <Plus aria-hidden className={ICON} />
              <span className="flex-1">{copy.palette.newNote}</span>
            </Command.Item>
            <Command.Item
              value="daily"
              keywords={keywordsInEveryLocale((c) => c.palette.openDaily, (c) => c.palette.keywords.daily)}
              onSelect={openDaily}
              className={ITEM}
            >
              <CalendarDays aria-hidden className={ICON} />
              <span className="flex-1">{copy.palette.openDaily}</span>
            </Command.Item>
          </Command.Group>
        ) : null}

        {mode === "all" ? (
          <Command.Group heading={copy.palette.groups.go} className={GROUP}>
            {NAV_ITEMS.map((item) => (
              <Command.Item
                key={item.id}
                value={`go-${item.id}`}
                keywords={[...keywordsInEveryLocale((c) => c.nav[item.id]), item.id, item.href]}
                onSelect={() => go(item.href)}
                className={ITEM}
              >
                <item.icon aria-hidden className={ICON} />
                <span className="flex-1">{copy.nav[item.id]}</span>
                {item.goKey ? <Hint keys={["g", item.goKey]} /> : null}
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {mode === "all" ? (
          <Command.Group heading={copy.palette.groups.theme} className={GROUP}>
            {(
              [
                ["light", Sun],
                ["dark", Moon],
                ["system", Monitor],
              ] as const
            ).map(([value, Icon]) => (
              <Command.Item
                key={value}
                value={`theme-${value}`}
                keywords={[...keywordsInEveryLocale((c) => c.palette.keywords.theme, (c) => c.theme.palette[value]), value]}
                onSelect={() => run(() => setTheme(value))}
                className={ITEM}
              >
                <Icon aria-hidden className={ICON} />
                <span className="flex-1">{copy.theme.palette[value]}</span>
                {theme === value ? <span className="text-xs text-mute">{copy.palette.current}</span> : null}
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {noteList.length > 0 || canCreate ? (
          <Command.Group heading={copy.palette.groups.notes} className={GROUP}>
            {noteList.map((note) => (
              <Command.Item key={note.id} value={`note-${note.id}`} keywords={[note.title, trimmed]} onSelect={() => go(`/notes/${note.id}`)} className={ITEM}>
                <FileText aria-hidden className={ICON} />
                <span className="flex-1 truncate">{note.title}</span>
              </Command.Item>
            ))}
            {canCreate ? (
              <Command.Item
                value={`create-${trimmed}`}
                keywords={[trimmed, ...keywordsInEveryLocale((c) => c.palette.newNote)]}
                onSelect={() => createNote(trimmed)}
                className={ITEM}
              >
                <Plus aria-hidden className={ICON} />
                <span className="flex-1 truncate">
                  <span className="text-mute">{copy.palette.createPrefix} </span>
                  {trimmed}
                </span>
              </Command.Item>
            ) : null}
          </Command.Group>
        ) : null}
      </Command.List>

      <div className="hidden items-center gap-3 border-t border-line px-3 py-1.5 text-2xs text-mute sm:flex">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> {copy.palette.hints.move}
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>↵</Kbd> {copy.palette.hints.open}
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Kbd>{mod}</Kbd>
          <Kbd>P</Kbd> {copy.palette.notesOnly}
        </span>
      </div>
    </Command>
  );
}

const GROUP =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-mute";
const ITEM =
  "flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-ctl px-2.5 text-base text-ink data-[selected=true]:bg-accent-soft data-[selected=true]:text-ink aria-disabled:opacity-50";
const ICON = "size-4 shrink-0 text-mute";

function Hint({ keys }: { keys: readonly string[] }) {
  return (
    <span aria-hidden className="hidden items-center gap-0.5 sm:inline-flex">
      {keys.map((k, i) => (
        <Kbd key={`${k}-${i}`}>{k}</Kbd>
      ))}
    </span>
  );
}
