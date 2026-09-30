import { Suspense } from "react";
import { NotesLoading, NotesWorkspace } from "@/features/notes";

export default function NotesPage() {
  return <Suspense fallback={<NotesLoading />}><NotesWorkspace /></Suspense>;
}
