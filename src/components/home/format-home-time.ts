const SEOUL = "Asia/Seoul";

function seoulYmd(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

function seoulHm(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: SEOUL,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(date).replace(/^24:/, "00:");
}

/** Home inbox row time: 오늘 10:21 · 어제 21:05 · short fallback */
export function formatHomeInboxWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const ymd = seoulYmd(date);
  const today = seoulYmd(now);
  const time = seoulHm(date);
  if (ymd === today) return `오늘 ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (ymd === seoulYmd(yesterday)) return `어제 ${time}`;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
