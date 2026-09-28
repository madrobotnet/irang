"use client";

import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { NoteList } from "./NoteList";
import { NoteDetail } from "./NoteDetail";

export function NotesWorkspace({ selectedId }: { selectedId?: string }) {
  return (
    <div className="mx-auto flex h-[var(--workspace-h)] w-full max-w-[100rem] overflow-hidden lg:h-dvh">
      <NoteList selectedId={selectedId} />
      {selectedId ? <NoteDetail key={selectedId} noteId={selectedId} /> : (
        <div className="hidden min-w-0 flex-1 items-center justify-center p-8 lg:flex">
          <EmptyState icon={FileText} title="노트를 선택하세요" description="왼쪽 목록에서 노트를 열거나 새 노트를 만드세요." />
        </div>
      )}
    </div>
  );
}
