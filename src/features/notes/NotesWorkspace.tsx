"use client";

import { FileText } from "lucide-react";
import { useCopy } from "@/components/i18n";
import { EmptyState } from "@/components/ui";
import { NoteList } from "./NoteList";
import { NoteDetail } from "./NoteDetail";
import { NOTES_COPY } from "./copy";

export function NotesWorkspace({ selectedId }: { selectedId?: string }) {
  const copy = useCopy(NOTES_COPY);
  return (
    <div className="mx-auto flex h-[var(--workspace-h)] w-full max-w-[100rem] overflow-hidden lg:h-dvh">
      <NoteList selectedId={selectedId} />
      {selectedId ? <NoteDetail key={selectedId} noteId={selectedId} /> : (
        <div className="hidden min-w-0 flex-1 items-center justify-center p-8 lg:flex">
          <EmptyState icon={FileText} title={copy.workspace.emptyTitle} description={copy.workspace.emptyDescription} />
        </div>
      )}
    </div>
  );
}
