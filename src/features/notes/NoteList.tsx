"use client";

import { FilePlus2, FileText, Pin, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { useCopy } from "@/components/i18n";
import { Button, EmptyState, Input, SkeletonLines, TagBadge, useToast } from "@/components/ui";
import { api } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import type { NoteRef, NoteSummary, TagCount } from "@/lib/types";
import { refreshNoteViews } from "./note-cache";
import { NOTES_COPY } from "./copy";
import { calendarDaysAgo } from "./relative-day";

type NotesPage = { notes: NoteSummary[]; nextCursor: string | null };
type View = "all" | "pinned" | "archived" | "trash";

export function NoteList({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { mutate: mutateAll, cache } = useSWRConfig();
  const { toast } = useToast();
  const copy = useCopy(NOTES_COPY);
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? "";
  const rawView = params.get("view");
  const view: View = rawView === "pinned" || rawView === "archived" || rawView === "trash" ? rawView : "all";
  const tags = useSWR<{ tags: TagCount[] }>("/api/tags");
  const getKey = (index: number, previous: NotesPage | null) => {
    if (previous && !previous.nextCursor) return null;
    const query = new URLSearchParams({ limit: "30" });
    if (q) query.set("q", q);
    if (tag) query.set("tag", tag);
    if (view === "pinned") query.set("pinned", "1");
    if (view === "archived") query.set("archived", "1");
    if (view === "trash") query.set("trash", "1");
    if (index > 0 && previous?.nextCursor) query.set("cursor", previous.nextCursor);
    return `/api/notes?${query}`;
  };
  const list = useSWRInfinite<NotesPage>(getKey, { revalidateFirstPage: true, keepPreviousData: true });
  const notes = list.data?.flatMap((page) => page.notes) ?? [];
  const hasMore = Boolean(list.data?.at(-1)?.nextCursor);
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const create = async () => {
    try {
      const { note } = await api<{ note: NoteRef }>("/api/notes", { method: "POST", json: {} });
      await refreshNoteViews({ cache, mutate: mutateAll });
      router.push(`/notes/${note.id}`);
    } catch (error) {
      toast(textInEveryLocale((locale) => localizedApiError(error, locale, NOTES_COPY[locale].list.createFailed)), { tone: "danger" });
    }
  };

  return (
    <aside className={`${selectedId ? "hidden lg:flex" : "flex"} w-full shrink-0 flex-col border-r border-line bg-desk lg:w-80 xl:w-96`} aria-label={copy.list.label}>
      <header className="border-b border-line p-4">
        <div className="mb-3 flex items-center justify-between">
          <div><h1 className="text-xl font-semibold">{copy.list.heading}</h1><p className="text-xs text-mute">{copy.list.tagline}</p></div>
          <Button variant="primary" size="sm" leading={<FilePlus2 aria-hidden className="size-4" />} onClick={() => void create()}>{copy.list.newNote}</Button>
        </div>
        <Input aria-label={copy.list.searchLabel} placeholder={copy.list.searchPlaceholder} value={q} leading={<Search aria-hidden />} onChange={(event) => setParam("q", event.target.value)} trailing={q ? <button type="button" aria-label={copy.list.clearSearch} onClick={() => setParam("q", "")}><X aria-hidden className="size-4" /></button> : null} />
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1 scrollbar-thin" aria-label={copy.list.viewsLabel}>
          {(["all", "pinned", "archived", "trash"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setParam("view", value === "all" ? "" : value)} className={`rounded-pill px-3 py-1.5 text-sm ${view === value ? "bg-accent text-accent-ink" : "text-mute hover:bg-line/60 hover:text-ink"}`}>{copy.list.views[value]}</button>
          ))}
        </div>
        {tags.error ? <button type="button" className="mt-2 text-xs text-danger underline" onClick={() => void tags.mutate()}>{copy.list.tagsFailed}</button> : null}
        {(tags.data?.tags.length ?? 0) > 0 ? (
          <label className="mt-3 flex items-center gap-2 text-xs text-mute">{copy.list.tagFilter}
            <select className="min-w-0 flex-1 rounded-ctl border border-line bg-card px-2 py-1.5 text-sm text-ink" value={tag} onChange={(event) => setParam("tag", event.target.value)}>
              <option value="">{copy.list.allTags}</option>
              {tags.data?.tags.map((item) => <option key={item.tag} value={item.tag}>{item.tag} ({item.count})</option>)}
            </select>
          </label>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
        {list.isLoading ? <div className="p-3"><SkeletonLines lines={6} /></div> : null}
        {list.error ? <EmptyState title={copy.list.loadFailedTitle} description={copy.list.loadFailedDescription} action={<Button size="sm" onClick={() => void list.mutate()}>{copy.retry}</Button>} /> : null}
        {!list.isLoading && !list.error && notes.length === 0 ? <EmptyState icon={FileText} title={view === "trash" ? copy.list.trashEmpty : copy.list.empty} description={q || tag ? copy.list.emptyFiltered : copy.list.emptyStart} action={view !== "trash" ? <Button size="sm" onClick={() => void create()}>{copy.list.newNote}</Button> : undefined} /> : null}
        <ul className="space-y-1">
          {notes.map((note) => (
            <li key={note.id}>
              <Link href={`/notes/${note.id}${params.size ? `?${params}` : ""}`} className={`block rounded-card border px-3 py-3 transition-colors ${selectedId === note.id ? "border-accent bg-accent-soft" : "border-transparent hover:border-line hover:bg-card"}`}>
                <div className="flex items-start gap-2"><h2 className="min-w-0 flex-1 truncate font-medium">{note.title}</h2>{note.pinned ? <Pin aria-label={copy.list.pinned} className="size-3.5 shrink-0 text-accent" /> : null}</div>
                {note.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-mute">{note.excerpt}</p> : null}
                <div className="mt-2 flex items-center gap-1 overflow-hidden">{note.tags.slice(0, 2).map((item) => <TagBadge key={item} tag={item} />)}<time className="ml-auto shrink-0 text-xs text-mute">{copy.list.updated(calendarDaysAgo(note.updatedAt))}</time></div>
              </Link>
            </li>
          ))}
        </ul>
        {hasMore ? <Button className="mt-2 w-full" size="sm" loading={list.isValidating} onClick={() => void list.setSize(list.size + 1)}>{copy.list.loadMore}</Button> : null}
      </div>
    </aside>
  );
}
