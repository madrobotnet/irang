import type { Metadata } from "next";
import { InboxView } from "@/features/inbox";
import { INBOX_COPY } from "@/features/inbox/inbox-copy";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: INBOX_COPY[await getRequestLocale()].title };
}

export default function InboxPage() {
  return <InboxView />;
}
