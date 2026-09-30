"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCopy, useLocale } from "@/components/i18n";
import { Button, EmptyState, Input } from "@/components/ui";
import { api } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import type { NoteRef } from "@/lib/types";
import { NOTES_COPY } from "./copy";

function localDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function DailyLauncher() {
  const router = useRouter();
  const { locale } = useLocale();
  const copy = useCopy(NOTES_COPY).daily;
  const [date, setDate] = useState(localDate);
  const [busy, setBusy] = useState(true);
  // The failure itself, not its text, so a language switch re-renders the message.
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  const open = async (selected: string) => {
    setBusy(true);
    setFailure(null);
    try {
      const { note } = await api<{ note: NoteRef }>("/api/daily", { method: "POST", json: { date: selected } });
      router.replace(`/notes/${note.id}`);
    } catch (reason) {
      setFailure({ error: reason });
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    void api<{ note: NoteRef }>("/api/daily", { method: "POST", json: { date: localDate() } })
      .then(({ note }) => { if (active) router.replace(`/notes/${note.id}`); })
      .catch((reason: unknown) => {
        if (!active) return;
        setFailure({ error: reason });
        setBusy(false);
      });
    return () => { active = false; };
  }, [router]);

  return (
    <section aria-label={copy.label} className="flex min-h-[70dvh] items-center justify-center p-5">
      <div className="w-full max-w-md">
        <EmptyState
          icon={CalendarDays}
          title={busy ? copy.opening : copy.openFailed}
          description={failure ? localizedApiError(failure.error, locale, copy.openFailedDetail) : copy.preparing}
          action={!busy ? <div className="flex w-full flex-col gap-2 sm:flex-row"><Input aria-label={copy.date} type="date" value={date} onChange={(event) => setDate(event.target.value)} /><Button variant="primary" onClick={() => void open(date)}>{copy.open}</Button></div> : undefined}
        />
      </div>
    </section>
  );
}
