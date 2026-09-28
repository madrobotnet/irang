"use client";

import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Paperclip } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useTheme } from "@/components/shell/ThemeProvider";
import { api } from "@/lib/api-client";
import type { NoteRef } from "@/lib/types";

export function MarkdownEditor({ noteId, value, onChange, onAppend }: { noteId: string; value: string; onChange: (value: string) => void; onAppend: (markdown: string) => void }) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const extensions = useMemo(() => [
    markdown(),
    autocompletion({ override: [wikiCompletion] }),
    EditorView.lineWrapping,
    EditorView.theme({
      "&": { backgroundColor: "var(--card)", color: "var(--ink)" },
      ".cm-content": { minHeight: "24rem", padding: "1rem", caretColor: "var(--accent)" },
      ".cm-gutters": { backgroundColor: "var(--desk)", color: "var(--mute)", border: "none" },
      ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in oklab, var(--accent-soft) 45%, transparent)" },
      "&.cm-focused": { outline: "none" },
    }),
  ], []);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("noteId", noteId);
      const attachment = await api<{ markdown: string }>("/api/attachments", { method: "POST", body: form });
      const view = editorRef.current?.view;
      if (view) {
        const at = view.state.selection.main.head;
        view.dispatch({ changes: { from: at, insert: attachment.markdown } });
        view.focus();
      } else {
        onAppend(attachment.markdown);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "파일을 첨부하지 못했습니다.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="overflow-hidden rounded-card border border-line bg-card focus-within:ring-2 focus-within:ring-accent/30">
      <div className="flex items-center justify-between border-b border-line bg-desk px-3 py-2">
        <span className="text-xs text-mute">Markdown · [[ 를 입력해 노트 연결</span>
        <Button size="sm" variant="ghost" loading={uploading} leading={<Paperclip aria-hidden className="size-4" />} onClick={() => fileRef.current?.click()}>
          첨부
        </Button>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          aria-label="파일 첨부"
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}
        />
      </div>
      {uploadError ? <p role="alert" className="border-b border-line bg-danger-soft px-3 py-2 text-sm text-danger">{uploadError}</p> : null}
      <CodeMirror ref={editorRef} value={value} theme={resolvedTheme} extensions={extensions} onChange={onChange} basicSetup={{ foldGutter: false }} />
    </div>
  );
}

async function wikiCompletion(context: CompletionContext): Promise<CompletionResult | null> {
  const before = context.matchBefore(/\[\[[^\]\n|#]*$/);
  if (!before) return null;
  const query = before.text.slice(2);
  if (!context.explicit && query.length === 0) return null;
  try {
    const { notes } = await api<{ notes: NoteRef[] }>(`/api/notes/titles?q=${encodeURIComponent(query)}&limit=12`);
    return {
      from: before.from + 2,
      options: notes.map((note) => ({ label: note.title, type: "text", apply: `${note.title}]]` })),
      validFor: /^[^\]\n|#]*$/,
    };
  } catch {
    return null;
  }
}
