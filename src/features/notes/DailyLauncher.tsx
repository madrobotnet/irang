"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, EmptyState, Input } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { NoteRef } from "@/lib/types";

function localDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function DailyLauncher() {
  const router = useRouter();
  const [date, setDate] = useState(localDate);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const open = async (selected: string) => {
    setBusy(true);
    setError(null);
    try {
      const { note } = await api<{ note: NoteRef }>("/api/daily", { method: "POST", json: { date: selected } });
      router.replace(`/notes/${note.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "데일리 노트를 열지 못했습니다.");
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    void api<{ note: NoteRef }>("/api/daily", { method: "POST", json: { date: localDate() } })
      .then(({ note }) => { if (active) router.replace(`/notes/${note.id}`); })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "데일리 노트를 열지 못했습니다.");
        setBusy(false);
      });
    return () => { active = false; };
  }, [router]);

  return (
    <section aria-label="오늘 노트" className="flex min-h-[70dvh] items-center justify-center p-5">
      <div className="w-full max-w-md">
        <EmptyState
          icon={CalendarDays}
          title={busy ? "데일리 노트를 여는 중…" : "데일리 노트를 열지 못했습니다"}
          description={error ?? "선택한 지역 날짜의 노트를 준비하고 있습니다."}
          action={!busy ? <div className="flex w-full flex-col gap-2 sm:flex-row"><Input aria-label="날짜" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><Button variant="primary" onClick={() => void open(date)}>열기</Button></div> : undefined}
        />
      </div>
    </section>
  );
}
