import { Suspense } from "react";
import { NotesWorkspace } from "@/components/notes/NotesWorkspace";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";

export default function NotesPage() {
  return (
    <Suspense fallback={<SkeletonBlock lines={6} />}>
      <NotesWorkspace />
    </Suspense>
  );
}
