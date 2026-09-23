import { Suspense } from "react";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";

export default function ChatPage() {
  return (
    <Suspense fallback={<SkeletonBlock lines={4} />}>
      <ChatScreen />
    </Suspense>
  );
}
