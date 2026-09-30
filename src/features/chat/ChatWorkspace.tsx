"use client";

import { ArrowLeft, BookOpen, CircleAlert, MessageSquare, MoreHorizontal, Pencil, Plus, RefreshCw, Send, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR, { useSWRConfig } from "swr";
import { useCopy, useLocale } from "@/components/i18n";
import { DocumentTitle } from "@/components/i18n/DocumentTitle";
import { useTimeZone } from "@/components/i18n/useTimeZone";
import { Button, Dialog, EmptyState, Input, Skeleton, SkeletonLines, Textarea, buttonClassName, cn, useToast } from "@/components/ui";
import { ApiClientError } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import type { ChatMessage, ChatThread, Citation } from "@/lib/types";
import { STATUS_KEY, THREADS_KEY, createThread, deleteThread, getChatStatus, listThreads, renameThread, type ChatStatus } from "./api";
import { failureMessage, threadDateFormat } from "./chat-model";
import { CHAT_COPY } from "./copy";
import { useChatThread, type Exchange } from "./use-chat-thread";

/** Persistent thread navigation and the currently selected cited conversation. */
export function ChatWorkspace({ selectedThreadId }: { selectedThreadId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { locale } = useLocale();
  const copy = useCopy(CHAT_COPY);
  // Null through SSR and hydration, so dates render only once the viewer's own zone is known.
  const timeZone = useTimeZone();
  const dateFormat = useMemo(() => (timeZone ? threadDateFormat(locale, timeZone) : null), [locale, timeZone]);
  const threads = useSWR<{ threads: ChatThread[] }>(THREADS_KEY, listThreads, { revalidateOnFocus: true, shouldRetryOnError: false });
  const status = useSWR<ChatStatus>(STATUS_KEY, getChatStatus, { revalidateOnFocus: false, shouldRetryOnError: false });
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { thread } = await createThread();
      await threads.mutate((current) => ({ threads: [thread, ...(current?.threads ?? [])] }), { revalidate: false });
      router.push(`/chat/${thread.id}`);
    } catch (error) {
      toast(textInEveryLocale((locale) => localizedApiError(error, locale, CHAT_COPY[locale].createFailed)), { tone: "danger" });
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto grid h-[var(--workspace-h)] w-full max-w-7xl overflow-hidden lg:h-dvh lg:grid-cols-[18rem_minmax(0,1fr)]">
      <DocumentTitle title={copy.title} />
      <aside aria-label={copy.threadsHeading} className={cn("min-w-0 border-line bg-desk lg:flex lg:flex-col lg:border-r", selectedThreadId ? "hidden lg:flex" : "flex flex-col")}>
        <header className="flex items-center gap-3 border-b border-line px-4 py-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="mt-0.5 line-clamp-2 text-sm text-mute">{copy.lead}</p>
          </div>
          <Button variant="primary" size="lg" iconOnly aria-label={copy.newThread} loading={creating} onClick={() => void create()}>
            <Plus aria-hidden className="size-5" />
          </Button>
        </header>
        <StatusNotice status={status.data} loading={status.isLoading} error={status.error} retry={() => void status.mutate()} compact />
        <nav aria-label={copy.threadsHeading} className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
          {threads.isLoading && !threads.data ? <ThreadListSkeleton /> : null}
          {threads.error && !threads.data ? (
            <EmptyState variant="plain" icon={CircleAlert} title={copy.threadsLoadFailed} action={<Button size="lg" leading={<RefreshCw aria-hidden className="size-4" />} onClick={() => void threads.mutate()}>{copy.retry}</Button>} />
          ) : null}
          {threads.data?.threads.length === 0 ? (
            <EmptyState variant="plain" icon={MessageSquare} title={copy.threadsEmptyTitle} description={copy.threadsEmptyDescription} action={<Button variant="primary" size="lg" loading={creating} leading={<Plus aria-hidden className="size-4" />} onClick={() => void create()}>{copy.newThread}</Button>} />
          ) : null}
          {threads.data?.threads.length ? (
            <ul className="space-y-1">
              {threads.data.threads.map((thread) => (
                <li key={thread.id}>
                  <Link href={`/chat/${thread.id}`} aria-current={thread.id === selectedThreadId ? "page" : undefined} className={cn("flex min-h-touch flex-col justify-center rounded-ctl px-3 py-2 focus-ring", thread.id === selectedThreadId ? "bg-accent-soft" : "hover:bg-line/50")}>
                    <span className="truncate text-md font-medium">{thread.title}</span>
                    <span className="text-xs text-mute">{dateFormat?.format(new Date(thread.updatedAt))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </nav>
      </aside>
      <section aria-label={copy.conversation} className={cn("min-w-0", !selectedThreadId && "hidden lg:block")}>
        {selectedThreadId ? (
          <ThreadView key={selectedThreadId} threadId={selectedThreadId} status={status.data} statusLoading={status.isLoading} statusError={status.error} retryStatus={() => void status.mutate()} />
        ) : (
          <ChatLanding status={status.data} loading={status.isLoading} error={status.error} retry={() => void status.mutate()} create={create} creating={creating} />
        )}
      </section>
    </div>
  );
}

function ChatLanding({ status, loading, error, retry, create, creating }: { status?: ChatStatus; loading: boolean; error: unknown; retry: () => void; create: () => Promise<void>; creating: boolean }) {
  const copy = useCopy(CHAT_COPY);
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-8 py-12">
      <MessageSquare aria-hidden className="size-9 text-accent" />
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">{copy.title}</h2>
      <p className="mt-2 max-w-xl text-md text-mute">{copy.lead}</p>
      <StatusNotice status={status} loading={loading} error={error} retry={retry} />
      <Button className="mt-5 self-start" variant="primary" size="lg" loading={creating} leading={<Plus aria-hidden className="size-4" />} onClick={() => void create()}>{copy.newThread}</Button>
    </div>
  );
}

function StatusNotice({ status, loading, error, retry, compact = false }: { status?: ChatStatus; loading: boolean; error: unknown; retry: () => void; compact?: boolean }) {
  const copy = useCopy(CHAT_COPY);
  if (status?.available) return null;
  if (loading && !status) return <p className={cn("text-sm text-mute", compact ? "border-b border-line px-4 py-3" : "mt-5")}>{copy.statusChecking}</p>;
  const failed = Boolean(error);
  return (
    <div role={failed ? "alert" : "status"} className={cn("border-warn/30 bg-warn-soft text-ink", compact ? "border-b px-4 py-3" : "mt-5 rounded-card border px-4 py-4")}>
      <div className="flex items-start gap-2.5">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{failed ? copy.statusCheckFailed : copy.statusUnavailableTitle}</p>
          {!failed && !compact ? <p className="mt-1 text-sm text-mute">{copy.statusUnavailableDescription}</p> : null}
          {failed ? <Button className="mt-2" size="sm" leading={<RefreshCw aria-hidden className="size-3.5" />} onClick={retry}>{copy.statusRecheck}</Button> : null}
        </div>
      </div>
    </div>
  );
}

function ThreadView({ threadId, status, statusLoading, statusError, retryStatus }: { threadId: string; status?: ChatStatus; statusLoading: boolean; statusError: unknown; retryStatus: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { mutate } = useSWRConfig();
  const chat = useChatThread(threadId);
  const { locale } = useLocale();
  const copy = useCopy(CHAT_COPY);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const failureLocale = chat.exchange?.phase === "failed" ? locale : null;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [chat.messages.length, chat.exchange?.text, chat.exchange?.phase, failureLocale]);
  const openRename = () => { setTitle(chat.thread?.title ?? ""); setRenameOpen(true); };
  const saveTitle = async (event: FormEvent) => {
    event.preventDefault();
    const next = title.trim();
    if (!next || savingTitle) return;
    setSavingTitle(true);
    try {
      const { thread } = await renameThread(threadId, next);
      await mutate(THREADS_KEY, (current: { threads: ChatThread[] } | undefined) => current ? { threads: current.threads.map((item) => item.id === thread.id ? thread : item) } : current, { revalidate: false });
      chat.reload();
      setRenameOpen(false);
    } catch (error) { toast(textInEveryLocale((locale) => localizedApiError(error, locale, CHAT_COPY[locale].renameFailed)), { tone: "danger" }); }
    finally { setSavingTitle(false); }
  };
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteThread(threadId);
      await mutate(THREADS_KEY, (current: { threads: ChatThread[] } | undefined) => current ? { threads: current.threads.filter((item) => item.id !== threadId) } : current, { revalidate: false });
      toast(textInEveryLocale((locale) => CHAT_COPY[locale].deleted), { tone: "ok" });
      router.replace("/chat");
    } catch (error) { toast(textInEveryLocale((locale) => localizedApiError(error, locale, CHAT_COPY[locale].deleteFailed)), { tone: "danger" }); setDeleting(false); }
  };

  if (chat.loading && !chat.thread) return <ThreadSkeleton />;
  if (chat.loadError && !chat.thread) {
    const notFound = chat.loadError instanceof ApiClientError && chat.loadError.status === 404;
    return <div className="flex min-h-[calc(100dvh-var(--topbar-h)-var(--bottomnav-h))] items-center justify-center px-5 lg:min-h-dvh"><EmptyState icon={CircleAlert} title={notFound ? copy.threadNotFound : copy.threadLoadFailed} action={notFound ? <Link href="/chat" className={buttonClassName({ size: "lg" })}>{copy.back}</Link> : <Button size="lg" onClick={chat.reload}>{copy.retry}</Button>} /></div>;
  }

  return (
    <div className="flex h-[var(--workspace-h)] min-h-0 flex-col lg:h-dvh">
      <header className="flex min-h-touch items-center gap-2 border-b border-line bg-card px-3 py-2 sm:px-5">
        <Link href="/chat" className={cn(buttonClassName({ variant: "ghost", size: "lg", iconOnly: true }), "lg:hidden")} aria-label={copy.back}><ArrowLeft aria-hidden className="size-5" /></Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{chat.thread?.title}</h1>
        <Button variant="ghost" size="lg" iconOnly aria-label={copy.rename} disabled={chat.streaming} onClick={openRename}><Pencil aria-hidden className="size-4" /></Button>
        <Button variant="ghost" size="lg" iconOnly aria-label={copy.delete} disabled={chat.streaming} onClick={() => setDeleteOpen(true)}><Trash2 aria-hidden className="size-4" /></Button>
      </header>
      <StatusNotice status={status} loading={statusLoading} error={statusError} retry={retryStatus} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 scrollbar-thin sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {chat.messages.length === 0 && !chat.exchange ? <EmptyState icon={MessageSquare} title={copy.historyEmptyTitle} description={copy.historyEmptyDescription} /> : null}
          {chat.messages.map((message) => <Message key={message.id} message={message} />)}
          {chat.exchange ? <PendingExchange exchange={chat.exchange} onDismiss={chat.dismissFailure} onResend={chat.resend} /> : null}
          <div ref={endRef} aria-hidden />
        </div>
      </div>
      <Composer draft={chat.draft} setDraft={chat.setDraft} send={chat.send} stop={chat.stop} streaming={chat.streaming} available={status?.available === true} />
      <Dialog open={renameOpen} onOpenChange={setRenameOpen} title={copy.rename} footer={<><Button size="lg" onClick={() => setRenameOpen(false)}>{copy.renameCancel}</Button><Button form="rename-thread" type="submit" variant="primary" size="lg" loading={savingTitle} disabled={!title.trim()}>{copy.renameSave}</Button></>}>
        <form id="rename-thread" onSubmit={(event) => void saveTitle(event)}><Input label={copy.renameLabel} value={title} maxLength={300} autoFocus onChange={(event) => setTitle(event.target.value)} /></form>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title={copy.deleteTitle} description={copy.deleteDescription} footer={<><Button size="lg" onClick={() => setDeleteOpen(false)}>{copy.renameCancel}</Button><Button variant="danger" size="lg" loading={deleting} onClick={() => void remove()}>{copy.deleteConfirm}</Button></>} />
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const copy = useCopy(CHAT_COPY);
  const assistant = message.role === "assistant";
  return (
    <article aria-label={assistant ? copy.assistantLabel : copy.userLabel} className={cn("flex", assistant ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[92%] sm:max-w-[82%]", assistant ? "w-full" : "rounded-card bg-accent px-4 py-3 text-accent-ink")}>
        <p className={cn("mb-1 text-xs font-medium", assistant ? "text-mute" : "text-accent-ink/80")}>{assistant ? copy.assistantLabel : copy.userLabel}</p>
        {assistant ? <SafeMarkdown content={message.content} /> : <p className="whitespace-pre-wrap text-md leading-relaxed">{message.content}</p>}
        {assistant && message.citations.length > 0 ? <Sources citations={message.citations} /> : null}
      </div>
    </article>
  );
}

function SafeMarkdown({ content }: { content: string }) {
  const copy = useCopy(CHAT_COPY);
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
      h1: ({ children }) => <h2 className="mb-2 mt-4 text-xl font-semibold first:mt-0">{children}</h2>,
      h2: ({ children }) => <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>,
      h3: ({ children }) => <h4 className="mb-1 mt-3 text-md font-semibold first:mt-0">{children}</h4>,
      p: ({ children }) => <p className="my-2 text-md leading-relaxed first:mt-0 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-md">{children}</ul>,
      ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-md">{children}</ol>,
      blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-accent pl-3 text-mute">{children}</blockquote>,
      code: ({ children, className }) => className ? <code className={cn("block overflow-x-auto rounded-ctl bg-rail p-3 text-sm text-rail-ink scrollbar-thin", className)}>{children}</code> : <code className="rounded bg-line/60 px-1 py-0.5 text-sm">{children}</code>,
      pre: ({ children }) => <pre className="my-3 overflow-x-auto">{children}</pre>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="rounded-sm font-medium text-accent underline underline-offset-2 focus-ring">{children}</a>,
      img: ({ alt }) => <span className="text-sm text-mute">{alt ?? copy.imageFallback}</span>,
      table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
      th: ({ children }) => <th className="border border-line bg-desk px-2 py-1.5 text-left font-semibold">{children}</th>,
      td: ({ children }) => <td className="border border-line px-2 py-1.5 align-top">{children}</td>,
    }}>{content}</ReactMarkdown>
  );
}

function Sources({ citations }: { citations: Citation[] }) {
  const copy = useCopy(CHAT_COPY);
  return (
    <section aria-label={copy.sources} className="mt-4 border-t border-line pt-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-mute"><BookOpen aria-hidden className="size-4" />{copy.sources}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {citations.map((citation) => <Link key={`${citation.index}-${citation.noteId}`} href={`/notes/${citation.noteId}`} className="surface-desk group min-w-0 p-3 hover:border-accent focus-ring"><span className="text-xs font-medium text-accent">{copy.sourceLabel(citation.index)}</span><p className="mt-0.5 truncate text-sm font-semibold group-hover:text-accent">{citation.title}</p>{citation.excerpt ? <p className="mt-1 line-clamp-3 text-xs text-mute">{citation.excerpt}</p> : null}<span className="mt-2 inline-block text-xs font-medium text-mute">{copy.sourceOpen}</span></Link>)}
      </div>
    </section>
  );
}

function PendingExchange({ exchange, onDismiss, onResend }: { exchange: Exchange; onDismiss: () => void; onResend: () => void }) {
  const { locale } = useLocale();
  const copy = useCopy(CHAT_COPY);
  return (
    <><Message message={{ id: "pending-user", role: "user", content: exchange.content, citations: [], createdAt: "" }} /><article aria-label={copy.assistantLabel} className="w-full" aria-live="polite">
      {exchange.text ? <><p className="mb-1 text-xs font-medium text-mute">{copy.assistantLabel}</p>{exchange.phase === "failed" ? <p className="mb-2 text-xs font-medium text-warn">{copy.partialAnswer}</p> : null}<SafeMarkdown content={exchange.text} />{exchange.citations.length > 0 ? <Sources citations={exchange.citations} /> : null}</> : exchange.phase === "streaming" ? <div className="flex items-center gap-2 text-sm text-mute"><MoreHorizontal aria-hidden className="size-5 animate-pulse" />{exchange.citations.length ? copy.streaming : copy.thinking}</div> : null}
      {exchange.phase === "failed" ? <div role="alert" className="mt-3 rounded-card border border-danger/30 bg-danger-soft px-4 py-3"><p className="font-medium text-danger">{copy.failedTitle}</p><p className="mt-1 text-sm">{exchange.failure ? failureMessage(exchange.failure, locale) : null}</p><p className="mt-1 text-xs text-mute">{copy.failedDraftKept}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={onDismiss}>{copy.dismiss}</Button><Button variant="primary" size="sm" onClick={onResend}>{copy.resend}</Button></div></div> : null}
    </article></>
  );
}

function Composer({ draft, setDraft, send, stop, streaming, available }: { draft: string; setDraft: (value: string) => void; send: (value: string) => Promise<void>; stop: () => void; streaming: boolean; available: boolean }) {
  const copy = useCopy(CHAT_COPY);
  const submit = () => { if (available && !streaming && draft.trim()) void send(draft); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
  };
  return (
    <div className="border-t border-line bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-10"><div className="mx-auto flex max-w-3xl items-end gap-2">
      <Textarea aria-label={copy.composerLabel} value={draft} rows={2} maxLength={8000} disabled={!available || streaming} placeholder={copy.composerPlaceholder} hint={available ? <span className="hidden sm:inline">{copy.composerHint}</span> : undefined} wrapperClassName="min-w-0 flex-1" className="max-h-36 min-h-touch resize-none" onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} />
      {streaming ? <Button variant="danger" size="lg" iconOnly aria-label={copy.stop} onClick={stop}><Square aria-hidden className="size-4 fill-current" /></Button> : <Button variant="primary" size="lg" iconOnly aria-label={copy.send} disabled={!available || !draft.trim()} onClick={submit}><Send aria-hidden className="size-4" /></Button>}
    </div></div>
  );
}

function ThreadListSkeleton() {
  const copy = useCopy(CHAT_COPY);
  return <div aria-label={copy.threadsLoading} aria-busy="true" className="space-y-3 px-2 py-3"><SkeletonLines lines={6} /></div>;
}
function ThreadSkeleton() {
  const copy = useCopy(CHAT_COPY);
  return <div aria-label={copy.threadLoading} aria-busy="true" className="flex h-[var(--workspace-h)] flex-col lg:h-dvh"><div className="flex items-center gap-3 border-b border-line px-5 py-4"><Skeleton className="h-5 w-1/3" /></div><div className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-8"><SkeletonLines lines={3} /><SkeletonLines lines={5} /></div></div>;
}
