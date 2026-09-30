import type { Metadata } from "next";
import { ChatWorkspace } from "@/features/chat";
import { CHAT_COPY } from "@/features/chat/copy";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: CHAT_COPY[await getRequestLocale()].title };
}

export default function ChatPage() {
  return <ChatWorkspace />;
}
