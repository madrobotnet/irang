import type { Metadata } from "next";
import { ChatWorkspace } from "@/features/chat";

export const metadata: Metadata = { title: "채팅" };

export default function ChatPage() {
  return <ChatWorkspace />;
}
