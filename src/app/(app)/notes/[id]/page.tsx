import { Suspense } from "react";
import { NotesWorkspace } from "@/features/notes";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<div className="p-6 text-sm text-mute">노트를 불러오는 중…</div>}><NotesWorkspace selectedId={id} /></Suspense>;
}
