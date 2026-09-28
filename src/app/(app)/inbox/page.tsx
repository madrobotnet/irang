import type { Metadata } from "next";
import { InboxView } from "@/features/inbox";

export const metadata: Metadata = { title: "인박스" };

export default function InboxPage() {
  return <InboxView />;
}
