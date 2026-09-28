import { Suspense } from "react";
import { NotesWorkspace } from "@/features/notes";

export default function NotesPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-mute">노트를 불러오는 중…</div>}><NotesWorkspace /></Suspense>;
}
