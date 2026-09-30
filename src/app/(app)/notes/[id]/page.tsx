import { Suspense } from "react";
import { NotesLoading, NotesWorkspace } from "@/features/notes";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<NotesLoading />}><NotesWorkspace selectedId={id} /></Suspense>;
}
