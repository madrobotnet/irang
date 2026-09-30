"use client";

import { Unlink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import useSWR from "swr";
import { useCopy } from "@/components/i18n";
import { Button, EmptyState, SkeletonLines, useToast } from "@/components/ui";
import { LocalGraph } from "@/features/graph/LocalGraph";
import { api } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import type { NoteLinks, NoteRef, RelatedNote } from "@/lib/types";
import { NOTES_COPY } from "./copy";

export function NoteConnections({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const copy = useCopy(NOTES_COPY);
  const links = useSWR<NoteLinks>(`/api/notes/${noteId}/links`, { revalidateOnFocus: true });
  const related = useSWR<{ notes: RelatedNote[] }>(`/api/notes/${noteId}/related?limit=6`, { revalidateOnFocus: false });
  const openTitle = async (title: string) => {
    try {
      const { note } = await api<{ note: NoteRef }>("/api/notes/by-title", { method: "POST", json: { title } });
      router.push(`/notes/${note.id}`);
    } catch (error) { toast(textInEveryLocale((locale) => localizedApiError(error, locale, NOTES_COPY[locale].openLinkFailed)), { tone: "danger" }); }
  };
  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="connections-title">
      <h2 id="connections-title" className="text-lg font-semibold">{copy.connections.heading}</h2>
      {links.isLoading ? <div className="mt-3"><SkeletonLines lines={3} /></div> : links.error ? <EmptyState className="mt-3" title={copy.connections.loadFailed} action={<Button size="sm" onClick={() => void links.mutate()}>{copy.retry}</Button>} /> : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <LinkGroup title={copy.connections.outgoing} empty={copy.connections.outgoingEmpty}>{links.data?.outgoing.map((item) => <NoteLink key={item.id} note={item} />)}{links.data?.unresolved.map((title) => <button key={title} type="button" className="flex items-center gap-2 rounded-ctl px-2 py-1.5 text-left text-sm text-warn hover:bg-warn-soft" onClick={() => void openTitle(title)}><Unlink aria-hidden className="size-3.5" />{title}<span className="text-xs">{copy.connections.create}</span></button>)}</LinkGroup>
          <LinkGroup title={copy.connections.backlinks} empty={copy.connections.backlinksEmpty}>{links.data?.backlinks.map((item) => <ContextLink key={item.id} item={item} />)}</LinkGroup>
          <LinkGroup title={copy.connections.unlinked} empty={copy.connections.unlinkedEmpty}>{links.data?.unlinkedMentions.map((item) => <ContextLink key={item.id} item={item} />)}</LinkGroup>
          <LinkGroup title={copy.connections.related} empty={copy.connections.relatedEmpty}>
            {related.isLoading ? <p className="text-sm text-mute">{copy.connections.relatedLoading}</p> : null}
            {related.error ? <Button size="sm" variant="ghost" onClick={() => void related.mutate()}>{copy.connections.relatedRetry}</Button> : null}
            {related.data?.notes.map((item) => <Link key={item.id} href={`/notes/${item.id}`} className="block rounded-ctl p-2 hover:bg-desk"><span className="text-sm font-medium">{item.title}</span><p className="line-clamp-2 text-xs text-mute">{item.excerpt}</p></Link>)}
          </LinkGroup>
        </div>
      )}
      <div className="mt-5 overflow-hidden rounded-card border border-line bg-card"><LocalGraph noteId={noteId} depth={1} height={280} /></div>
    </section>
  );
}

function LinkGroup({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const array = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  return <div className="rounded-card border border-line bg-card p-3"><h3 className="mb-2 text-sm font-semibold">{title}</h3>{array.length ? <div className="space-y-1">{children}</div> : <p className="text-sm text-mute">{empty}</p>}</div>;
}
function NoteLink({ note }: { note: NoteRef }) { return <Link href={`/notes/${note.id}`} className="block rounded-ctl px-2 py-1.5 text-sm text-accent hover:bg-accent-soft">{note.title}</Link>; }
function ContextLink({ item }: { item: NoteRef & { context: string } }) { return <Link href={`/notes/${item.id}`} className="block rounded-ctl p-2 hover:bg-desk"><span className="text-sm font-medium text-accent">{item.title}</span><p className="line-clamp-2 text-xs text-mute">{item.context}</p></Link>; }
