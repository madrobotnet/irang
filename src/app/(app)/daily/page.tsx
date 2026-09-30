import { DailyLauncher } from "@/features/notes";
import { readDailyDateParam } from "@/features/notes/daily-date";

export default async function DailyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { date } = await searchParams;
  // Keyed by the requested day so moving between dates starts a fresh get-or-create.
  return <DailyLauncher key={typeof date === "string" ? date : String(date)} target={readDailyDateParam(date)} />;
}
