import type { Metadata } from "next";
import { ChatWorkspace } from "@/features/chat";
import { CHAT_COPY } from "@/features/chat/copy";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: CHAT_COPY[await getRequestLocale()].title };
}

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatWorkspace selectedThreadId={id} />;
}
