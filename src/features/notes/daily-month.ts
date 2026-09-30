import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";

/** Wire shape of `GET /api/daily/calendar?month=YYYY-MM` (server type `DailyMonth`). */
export type DailyMonth = { month: string; days: { date: string; noteId: string }[] };

/** Daily notes of one `YYYY-MM` month as date -> note id; `null` fetches nothing. */
export function useDailyMonth(month: string | null) {
  const { data, error, isLoading, mutate } = useSWR<DailyMonth>(
    month ? `/api/daily/calendar?month=${month}` : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  const notes = useMemo(() => new Map((data?.days ?? []).map((day) => [day.date, day.noteId])), [data]);
  return { notes, error: error as unknown, isLoading, retry: () => void mutate() };
}
