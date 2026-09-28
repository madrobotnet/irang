"use client";

import { Unlink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import useSWR from "swr";
import { Button, EmptyState, SkeletonLines, useToast } from "@/components/ui";
import { LocalGraph } from "@/features/graph/LocalGraph";
import { api } from "@/lib/api-client";
import type { NoteLinks, NoteRef, RelatedNote } from "@/lib/types";

export function NoteConnections({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const links = useSWR<NoteLinks>(`/api/notes/${noteId}/links`, { revalidateOnFocus: true });
  const related = useSWR<{ notes: RelatedNote[] }>(`/api/notes/${noteId}/related?limit=6`, { revalidateOnFocus: false });
  const openTitle = async (title: string) => {
    try {
      const { note } = await api<{ note: NoteRef }>("/api/notes/by-title", { method: "POST", json: { title } });
      router.push(`/notes/${note.id}`);
    } catch (error) { toast(message(error, "연결 노트를 열지 못했습니다."), { tone: "danger" }); }
  };
  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="connections-title">
      <h2 id="connections-title" className="text-lg font-semibold">연결</h2>
      {links.isLoading ? <div className="mt-3"><SkeletonLines lines={3} /></div> : links.error ? <EmptyState className="mt-3" title="연결 정보를 불러오지 못했습니다" action={<Button size="sm" onClick={() => void links.mutate()}>다시 시도</Button>} /> : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <LinkGroup title="이 노트가 연결한 노트" empty="아직 나가는 링크가 없습니다.">{links.data?.outgoing.map((item) => <NoteLink key={item.id} note={item} />)}{links.data?.unresolved.map((title) => <button key={title} type="button" className="flex items-center gap-2 rounded-ctl px-2 py-1.5 text-left text-sm text-warn hover:bg-warn-soft" onClick={() => void openTitle(title)}><Unlink aria-hidden className="size-3.5" />{title}<span className="text-xs">만들기</span></button>)}</LinkGroup>
          <LinkGroup title="백링크" empty="이 노트를 연결한 노트가 없습니다.">{links.data?.backlinks.map((item) => <ContextLink key={item.id} item={item} />)}</LinkGroup>
          <LinkGroup title="연결되지 않은 언급" empty="일반 텍스트 언급이 없습니다.">{links.data?.unlinkedMentions.map((item) => <ContextLink key={item.id} item={item} />)}</LinkGroup>
          <LinkGroup title="관련 노트" empty="비슷한 텍스트의 노트가 없습니다.">
            {related.isLoading ? <p className="text-sm text-mute">관련 노트를 찾는 중…</p> : null}
            {related.error ? <Button size="sm" variant="ghost" onClick={() => void related.mutate()}>불러오기 다시 시도</Button> : null}
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
function message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
