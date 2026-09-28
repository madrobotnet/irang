"use client";

import { CalendarDays, FilePlus2, History, Inbox, Pin, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { useShell } from "@/components/shell/ShellProvider";
import { Badge, TagBadge } from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { Shortcut } from "@/components/ui/Kbd";
import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api-client";
import type { HomeData, InboxItem, NoteRef, NoteSummary } from "@/lib/types";
import { dailyForDate, homeHeadline, recentWithoutPinned, relativeTime, SOURCE_LABEL } from "./home-model";
import { formatDateKey, useLocalDate } from "./use-local-date";

type HomeSnapshot = { home: HomeData; fetchedAt: number };

/** Relative times are measured from the moment the snapshot arrived, so render stays pure. */
const fetchHome = async (path: string): Promise<HomeSnapshot> => ({ home: await api<HomeData>(path), fetchedAt: Date.now() });

export const HOME_KEY = "/api/home";

/** Live home: what needs triage, today's note, what you touched last, and what to revisit. */
export function HomeDashboard() {
  const router = useRouter();
  const shell = useShell();
  const { toast } = useToast();
  const today = useLocalDate();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error, isLoading, mutate } = useSWR<HomeSnapshot>(`${HOME_KEY}?timeZone=${encodeURIComponent(timeZone)}`, fetchHome, { revalidateOnFocus: true });
  const [busy, setBusy] = useState<"note" | "daily" | null>(null);

  // Capture/triage elsewhere refreshes the shell's inbox count; follow it so both numbers agree.
  const { inboxCount } = shell;
  useEffect(() => {
    if (inboxCount !== null) void mutate();
  }, [inboxCount, mutate]);

  const open = async (kind: "note" | "daily") => {
    if (kind === "daily" && !today) return;
    setBusy(kind);
    try {
      const { note } =
        kind === "note"
          ? await api<{ note: NoteRef }>("/api/notes", { method: "POST", json: {} })
          : await api<{ note: NoteRef }>("/api/daily", { method: "POST", json: { date: today } });
      router.push(`/notes/${note.id}`);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "노트를 만들지 못했습니다.", { tone: "danger" });
      setBusy(null);
    }
  };

  const home = data?.home;
  const daily = home && today ? dailyForDate(home, today) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6 lg:px-10 lg:pt-10">
      <header className="flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="min-h-5 text-sm text-mute">{today ? formatDateKey(today) : null}</p>
          {home ? (
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance lg:text-3xl">{homeHeadline(home, daily !== null)}</h1>
          ) : (
            <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">홈</h1>
          )}
          {home ? <Counts stats={home.stats} /> : <p className="mt-2 min-h-5" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="lg"
            leading={<Zap aria-hidden className="size-4" />}
            trailing={<span className="ml-1 hidden lg:inline-flex"><Shortcut keys={["c"]} /></span>}
            onClick={shell.openCapture}
          >
            빠르게 캡처
          </Button>
          <Button
            size="lg"
            leading={<FilePlus2 aria-hidden className="size-4" />}
            loading={busy === "note"}
            disabled={busy !== null}
            onClick={() => void open("note")}
          >
            새 노트
          </Button>
        </div>
      </header>

      {error && !home ? (
        <div role="alert" className="mt-6 flex flex-col items-start gap-3 rounded-card border border-danger/30 bg-danger-soft px-5 py-4">
          <div>
            <p className="text-md font-medium text-danger">홈 정보를 불러오지 못했습니다.</p>
            <p className="mt-0.5 text-sm text-ink">{error instanceof Error ? error.message : "네트워크 상태를 확인한 뒤 다시 시도해 주세요."}</p>
          </div>
          <Button size="lg" leading={<RefreshCw aria-hidden className="size-4" />} onClick={() => void mutate()}>
            다시 불러오기
          </Button>
        </div>
      ) : null}

      {isLoading && !home ? <HomeSkeleton /> : null}

      {home && data ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10">
          <div className="flex min-w-0 flex-col gap-8">
            <InboxSection count={home.inboxCount} items={home.inboxPreview} now={data.fetchedAt} onCapture={shell.openCapture} />
            <TodaySection
              today={today}
              daily={daily}
              busy={busy === "daily"}
              disabled={busy !== null || !today}
              onCreate={() => void open("daily")}
            />
            <RecentSection notes={recentWithoutPinned(home)} hasAnyNote={home.stats.notes > 0} now={data.fetchedAt} onCreate={() => void open("note")} busy={busy !== null} />
          </div>
          <aside aria-label="고정한 노트와 다시 볼 노트" className="flex min-w-0 flex-col gap-8">
            <PinnedSection notes={home.pinned} now={data.fetchedAt} />
            <ResurfaceSection notes={home.resurface} now={data.fetchedAt} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Counts({ stats }: { stats: HomeData["stats"] }) {
  const link = "rounded-ctl underline decoration-line-strong underline-offset-4 hover:text-accent hover:decoration-accent focus-ring";
  return (
    <p className="mt-2 text-sm text-mute">
      <Link href="/notes" className={link}>
        노트 <span className="font-medium tabular-nums text-ink">{stats.notes}</span>개
      </Link>
      {", "}
      <Link href="/graph" className={link}>
        연결 <span className="font-medium tabular-nums text-ink">{stats.links}</span>개
      </Link>
      {", "}
      태그 <span className="font-medium tabular-nums text-ink">{stats.tags}</span>개
    </p>
  );
}

function SectionHeading({ id, icon: Icon, title, count, action }: { id: string; icon: typeof Inbox; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-touch items-center gap-2 lg:min-h-9">
      <Icon aria-hidden className="size-4 text-mute" />
      <h2 id={id} className="text-md font-semibold tracking-tight">
        {title}
      </h2>
      {count !== undefined && count > 0 ? <Badge tone="accent" count={count} /> : null}
      <div className="ml-auto">{action}</div>
    </div>
  );
}

const SECTION_LINK = cn(buttonClassName({ variant: "ghost", size: "sm" }), "h-touch text-mute hover:text-ink lg:h-8");

function InboxSection({ count, items, now, onCapture }: { count: number; items: InboxItem[]; now: number; onCapture: () => void }) {
  return (
    <section aria-labelledby="home-inbox">
      <SectionHeading
        id="home-inbox"
        icon={Inbox}
        title="인박스"
        count={count}
        action={
          count > 0 ? (
            <Link href="/inbox" className={SECTION_LINK}>
              {count > items.length ? `${count}개 모두 정리하기` : "정리하기"}
            </Link>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="인박스가 비어 있어요"
          description="떠오른 생각이나 링크를 분류 없이 먼저 캡처해 두세요."
          action={
            <Button size="lg" leading={<Zap aria-hidden className="size-4" />} onClick={onCapture}>
              캡처하기
            </Button>
          }
        />
      ) : (
        <ul className="surface-card divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <li key={item.id}>
              <Link href="/inbox" className="flex min-h-touch flex-col gap-1 px-4 py-3 hover:bg-desk focus-ring sm:px-5">
                <span className="truncate text-md font-medium">{item.title || "제목 없는 캡처"}</span>
                {item.body ? <span className="line-clamp-2 text-sm text-mute">{item.body}</span> : null}
                <span className="text-xs text-mute">
                  {SOURCE_LABEL[item.source]}, {relativeTime(item.createdAt, now)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TodaySection({
  today,
  daily,
  busy,
  disabled,
  onCreate,
}: {
  today: string | null;
  daily: NoteSummary | null;
  busy: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <section aria-labelledby="home-today" className="relative overflow-hidden rounded-card border border-line bg-accent-soft/60 px-4 py-4 sm:px-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 id="home-today" className="flex items-center gap-2 text-sm font-medium text-mute">
            <CalendarDays aria-hidden className="size-4" />
            오늘 노트{today ? <span className="text-ink">{formatDateKey(today, { month: "long", day: "numeric" })}</span> : null}
          </h2>
          {daily ? (
            <>
              <p className="mt-1 truncate text-lg font-semibold tracking-tight">{daily.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-mute">{daily.excerpt || "아직 아무것도 적지 않았어요."}</p>
            </>
          ) : (
            <p className="mt-1 text-md text-ink">오늘 한 일과 떠오른 생각을 한 곳에 모아 두세요.</p>
          )}
        </div>
        {daily ? (
          <Link href={`/notes/${daily.id}`} className={buttonClassName({ variant: "primary", size: "lg" })}>
            이어 쓰기
          </Link>
        ) : (
          <Button variant="primary" size="lg" loading={busy} disabled={disabled} onClick={onCreate}>
            오늘 노트 만들기
          </Button>
        )}
      </div>
    </section>
  );
}

function NoteRow({ note, now, clamp = 1 }: { note: NoteSummary; now: number; clamp?: 1 | 2 }) {
  return (
    <Link href={`/notes/${note.id}`} className="-mx-2 flex min-h-touch flex-col gap-1 rounded-ctl px-2 py-2.5 hover:bg-desk focus-ring">
      <span className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-md font-medium">{note.title}</span>
        <span className="shrink-0 text-xs tabular-nums text-mute">{relativeTime(note.updatedAt, now)}</span>
      </span>
      {note.excerpt ? <span className={cn("text-sm text-mute", clamp === 1 ? "line-clamp-1" : "line-clamp-2")}>{note.excerpt}</span> : null}
      {note.tags.length > 0 ? (
        <span className="flex flex-wrap gap-1 pt-0.5">
          {note.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          {note.tags.length > 3 ? <span className="self-center text-xs text-mute">외 {note.tags.length - 3}개</span> : null}
        </span>
      ) : null}
    </Link>
  );
}

function RecentSection({
  notes,
  hasAnyNote,
  now,
  busy,
  onCreate,
}: {
  notes: NoteSummary[];
  hasAnyNote: boolean;
  now: number;
  busy: boolean;
  onCreate: () => void;
}) {
  return (
    <section aria-labelledby="home-recent">
      <SectionHeading
        id="home-recent"
        icon={History}
        title="최근 수정한 노트"
        action={
          hasAnyNote ? (
            <Link href="/notes" className={SECTION_LINK}>
              전체 노트
            </Link>
          ) : null
        }
      />
      {notes.length === 0 ? (
        <EmptyState
          title={hasAnyNote ? "최근 노트는 모두 고정되어 있어요" : "아직 노트가 없어요"}
          description={hasAnyNote ? "고정한 노트 목록에서 바로 열 수 있어요." : "새 노트를 만들거나 인박스의 캡처를 노트로 옮겨 보세요."}
          action={
            hasAnyNote ? null : (
              <Button size="lg" leading={<FilePlus2 aria-hidden className="size-4" />} disabled={busy} onClick={onCreate}>
                새 노트
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteRow note={note} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PinnedSection({ notes, now }: { notes: NoteSummary[]; now: number }) {
  return (
    <section aria-labelledby="home-pinned" className="surface-desk px-4 py-3 sm:px-5">
      <SectionHeading id="home-pinned" icon={Pin} title="고정한 노트" />
      {notes.length === 0 ? (
        <EmptyState
          variant="plain"
          title="고정한 노트가 없어요"
          description="자주 여는 노트를 노트 화면에서 고정하면 여기에 모여요."
          action={
            <Link href="/notes" className={buttonClassName({ size: "lg" })}>
              노트 보기
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteRow note={note} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResurfaceSection({ notes, now }: { notes: NoteSummary[]; now: number }) {
  return (
    <section aria-labelledby="home-resurface" className="px-1">
      <SectionHeading id="home-resurface" icon={RefreshCw} title="다시 볼 노트" />
      <p className="-mt-1 mb-2 text-sm text-mute">2주 넘게 손대지 않은 노트 가운데 오늘 고른 노트예요.</p>
      {notes.length === 0 ? (
        <EmptyState
          variant="plain"
          title="아직 다시 꺼낼 노트가 없어요"
          description="노트가 2주 넘게 쉬고 나면 하루에 몇 개씩 이곳에 다시 보여 드려요."
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteRow note={note} now={now} clamp={2} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10" aria-busy="true" aria-label="홈 정보를 불러오는 중">
      <div className="flex flex-col gap-8">
        <div className="surface-card flex flex-col gap-4 p-5">
          <Skeleton className="h-4 w-24" />
          <SkeletonLines lines={3} />
        </div>
        <Skeleton className="h-24 w-full rounded-card" />
        <SkeletonLines lines={6} />
      </div>
      <div className="surface-desk flex flex-col gap-4 p-5">
        <Skeleton className="h-4 w-28" />
        <SkeletonLines lines={4} />
      </div>
    </div>
  );
}
