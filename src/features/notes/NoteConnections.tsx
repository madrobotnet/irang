"use client";

import { Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useCopy, useLocale } from "@/components/i18n";
import { Button, EmptyState, SkeletonLines, useToast } from "@/components/ui";
import { LocalGraph } from "@/features/graph/LocalGraph";
import { SEARCH_COPY } from "@/features/search/search-copy";
import { matchLabel } from "@/features/search/search-model";
import { sourceNoteUrl } from "@/features/search/source-passage";
import { api } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import { formatDateTime } from "@/lib/i18n/format-date";
import type { MentionTarget } from "@/lib/link-mention";
import type { LinkContext, Note, NoteLinks, NoteRef, RelatedNote } from "@/lib/types";
import { NOTES_COPY } from "./copy";
import { LINKS_COPY } from "./links-copy";
import { linkUnlinkedMention, mentionExcerpt } from "./mention-link";
import { refreshNoteViews } from "./note-cache";

export function NoteConnections({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const copy = useCopy(NOTES_COPY);
  const mentionsCopy = useCopy(LINKS_COPY).mentions;
  const { cache, mutate } = useSWRConfig();
  const links = useSWR<NoteLinks>(`/api/notes/${noteId}/links`, { revalidateOnFocus: true });
  const related = useSWR<{ notes: RelatedNote[] }>(`/api/notes/${noteId}/related?limit=6`, { revalidateOnFocus: false });
  // NoteDetail's saved copy of this note: its title and aliases are what the server links.
  const target = useSWR<{ note: Note }>(`/api/notes/${noteId}`, { revalidateOnMount: false, revalidateOnFocus: false }).data?.note;
  const [linking, setLinking] = useState<ReadonlySet<string>>(() => new Set());
  const inFlight = useRef(new Set<string>());
  const unlinkedGroup = useRef<HTMLDivElement>(null);
  const refocus = useRef<{ id: string; index: number } | null>(null);
  // A linked row leaves the list; keep keyboard focus in the group instead of dropping it to the page.
  useEffect(() => {
    const pending = refocus.current;
    const group = unlinkedGroup.current;
    if (!pending || !group || links.data?.unlinkedMentions.some((item) => item.id === pending.id)) return;
    refocus.current = null;
    if (document.activeElement && document.activeElement !== document.body) return;
    const buttons = group.querySelectorAll<HTMLElement>("[data-mention-link]");
    (buttons[Math.min(pending.index, buttons.length - 1)] ?? group.querySelector<HTMLElement>("h3"))?.focus();
  }, [links.data]);
  const openTitle = async (title: string) => {
    try {
      const { note } = await api<{ note: NoteRef }>("/api/notes/by-title", { method: "POST", json: { title } });
      router.push(`/notes/${note.id}`);
    } catch (error) { toast(textInEveryLocale((locale) => localizedApiError(error, locale, NOTES_COPY[locale].openLinkFailed)), { tone: "danger" }); }
  };
  const linkMention = async (item: LinkContext, index: number) => {
    if (inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    setLinking((current) => new Set(current).add(item.id));
    const { title } = item;
    try {
      const outcome = await linkUnlinkedMention(noteId, item.id);
      if (outcome.kind === "linked") {
        refocus.current = { id: item.id, index };
        void mutate(`/api/notes/${item.id}`, { note: outcome.note }, { revalidate: false });
        await refreshNoteViews({ cache, mutate });
        toast(textInEveryLocale((locale) => LINKS_COPY[locale].mentions.linked(title)), { tone: "ok" });
      } else if (outcome.kind === "gone") {
        refocus.current = { id: item.id, index };
        await links.mutate((current) => current && { ...current, unlinkedMentions: current.unlinkedMentions.filter((mention) => mention.id !== item.id) });
        toast(textInEveryLocale((locale) => LINKS_COPY[locale].mentions.gone(title)), { tone: "info" });
      } else {
        toast(textInEveryLocale((locale) => LINKS_COPY[locale].mentions.stale(title)), { tone: "danger" });
        void links.mutate();
      }
    } catch (error) {
      toast(textInEveryLocale((locale) => localizedApiError(error, locale, LINKS_COPY[locale].mentions.failed)), { tone: "danger" });
      void links.mutate();
    } finally {
      inFlight.current.delete(item.id);
      setLinking((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };
  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="connections-title">
      <h2 id="connections-title" className="text-lg font-semibold">{copy.connections.heading}</h2>
      {links.isLoading ? <div className="mt-3"><SkeletonLines lines={3} /></div> : links.error ? <EmptyState className="mt-3" title={copy.connections.loadFailed} action={<Button size="sm" onClick={() => void links.mutate()}>{copy.retry}</Button>} /> : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <LinkGroup title={copy.connections.outgoing} empty={copy.connections.outgoingEmpty}>{links.data?.outgoing.map((item) => <NoteLink key={item.id} note={item} />)}{links.data?.unresolved.map((title) => <button key={title} type="button" className="flex items-center gap-2 rounded-ctl px-2 py-1.5 text-left text-sm text-warn hover:bg-warn-soft" onClick={() => void openTitle(title)}><Unlink aria-hidden className="size-3.5" />{title}<span className="text-xs">{copy.connections.create}</span></button>)}</LinkGroup>
          <LinkGroup title={copy.connections.backlinks} empty={copy.connections.backlinksEmpty}>{links.data?.backlinks.map((item) => <ContextLink key={item.id} item={item} />)}</LinkGroup>
          <LinkGroup title={copy.connections.unlinked} empty={copy.connections.unlinkedEmpty} groupRef={unlinkedGroup}>{links.data?.unlinkedMentions.map((item, index) => <MentionRow key={item.id} item={item} target={target} busy={linking.has(item.id)} label={mentionsCopy.link} accessibleLabel={mentionsCopy.linkLabel(item.title)} onLink={() => void linkMention(item, index)} />)}</LinkGroup>
          <LinkGroup title={copy.connections.related} description={copy.connections.relatedDescription} empty={copy.connections.relatedEmpty}>
            {related.isLoading ? <p className="text-sm text-mute">{copy.connections.relatedLoading}</p> : null}
            {related.error ? <Button size="sm" variant="ghost" onClick={() => void related.mutate()}>{copy.connections.relatedRetry}</Button> : null}
            {related.data?.notes.map((item) => <RelatedEvidenceLink key={item.id} note={item} />)}
          </LinkGroup>
        </div>
      )}
      <div className="mt-5 overflow-hidden rounded-card border border-line bg-card"><LocalGraph noteId={noteId} depth={1} height={280} /></div>
    </section>
  );
}

function LinkGroup({ title, description, empty, groupRef, children }: { title: string; description?: string; empty: string; groupRef?: Ref<HTMLDivElement>; children: ReactNode }) {
  const array = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  return <div ref={groupRef} className="rounded-card border border-line bg-card p-3"><h3 tabIndex={groupRef ? -1 : undefined} className="mb-2 text-sm font-semibold">{title}</h3>{description ? <p className="mb-2 text-xs text-mute">{description}</p> : null}{array.length ? <div className="space-y-1">{children}</div> : <p className="text-sm text-mute">{empty}</p>}</div>;
}
export function RelatedEvidenceLink({ note }: { note: RelatedNote }) {
  const { locale } = useLocale();
  const copy = useCopy(SEARCH_COPY);
  const notesCopy = useCopy(NOTES_COPY);
  const signals = matchLabel({ matchedBy: note.matchedBy ?? [] }, locale);
  return (
    <Link href={sourceNoteUrl(note.id, note.passage, note.updatedAt)} scroll={note.passage && note.updatedAt ? false : undefined} className="block rounded-ctl p-2 focus-ring hover:bg-desk">
      <span className="text-sm font-medium">{note.title || copy.untitled}</span>
      {note.passage ? <p className="mt-1 text-xs text-accent">{copy.passage(note.passage.heading, note.passage.startLine, note.passage.endLine)}</p> : null}
      <p className="line-clamp-2 text-xs text-mute">{note.excerpt}</p>
      {note.passage && !note.updatedAt ? <p className="mt-1 text-xs text-mute">{notesCopy.connections.passageUnverified}</p> : null}
      <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-mute">
        {signals.length ? <span>{signals.join(", ")}</span> : null}
        {note.updatedAt ? <time dateTime={note.updatedAt}>{formatDateTime(note.updatedAt, locale)}</time> : null}
      </div>
    </Link>
  );
}
function NoteLink({ note }: { note: NoteRef }) { return <Link href={`/notes/${note.id}`} className="block rounded-ctl px-2 py-1.5 text-sm text-accent hover:bg-accent-soft">{note.title}</Link>; }
function ContextLink({ item }: { item: NoteRef & { context: string } }) { return <Link href={`/notes/${item.id}`} className="block rounded-ctl p-2 hover:bg-desk"><span className="text-sm font-medium text-accent">{item.title}</span><p className="line-clamp-2 text-xs text-mute">{item.context}</p></Link>; }
function MentionRow({ item, target, busy, label, accessibleLabel, onLink }: { item: LinkContext; target: MentionTarget | undefined; busy: boolean; label: string; accessibleLabel: string; onLink: () => void }) {
  const excerpt = target ? mentionExcerpt(item.context, target) : null;
  return (
    <div className="flex items-start gap-1">
      <Link href={`/notes/${item.id}`} className="block min-w-0 flex-1 rounded-ctl p-2 hover:bg-desk">
        <span className="text-sm font-medium text-accent">{item.title}</span>
        <p className="line-clamp-2 text-xs text-mute">{excerpt ? <>{excerpt.before}<mark className="rounded-sm bg-accent-soft text-ink">{excerpt.match}</mark>{excerpt.after}</> : item.context}</p>
      </Link>
      <Button size="sm" className="mt-1 min-h-touch sm:min-h-0" data-mention-link loading={busy} aria-label={accessibleLabel} leading={<Link2 aria-hidden className="size-4" />} onClick={onLink}>{label}</Button>
    </div>
  );
}
