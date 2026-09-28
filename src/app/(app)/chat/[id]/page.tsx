import type { Metadata } from "next";
import { ChatWorkspace } from "@/features/chat";

export const metadata: Metadata = { title: "채팅" };

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatWorkspace selectedThreadId={id} />;
}
