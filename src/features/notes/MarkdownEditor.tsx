"use client";

import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror, { oneDarkTheme, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Paperclip } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useCopy, useLocale } from "@/components/i18n";
import { Button, useToast } from "@/components/ui";
import { useTheme } from "@/components/shell/ThemeProvider";
import { api } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import type { NoteRef, NoteTitleMatch } from "@/lib/types";
import { NOTES_COPY } from "./copy";
import { LINKS_COPY } from "./links-copy";
import { attachmentMarkdownAt } from "./markdown";
import { refreshNoteViews } from "./note-cache";
import { wikiLinkCompletion, wikiLinkEnv, type FetchTitles } from "./wikilink-autocomplete";

const writingHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.375em", fontWeight: "700" },
  { tag: tags.heading2, fontSize: "1.2em", fontWeight: "700" },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontSize: "1.05em", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "var(--accent)" },
  { tag: tags.monospace, fontFamily: "var(--font-mono)" },
  { tag: [tags.processingInstruction, tags.meta], color: "var(--mute)" },
]);

// Completion keys come from wikiLinkCompletion, guarded against IME composition.
const BASIC_SETUP = { foldGutter: false, lineNumbers: false, highlightActiveLineGutter: false, highlightActiveLine: false, syntaxHighlighting: false, completionKeymap: false };

const fetchNoteTitles: FetchTitles = async (query, signal) =>
  (await api<{ notes: NoteTitleMatch[] }>(`/api/notes/titles?q=${encodeURIComponent(query)}&limit=12`, { signal })).notes;

export function MarkdownEditor({ noteId, value, onChange, onAppend }: { noteId: string; value: string; onChange: (value: string) => void; onAppend: (markdown: string) => void }) {
  const { resolvedTheme } = useTheme();
  const { locale } = useLocale();
  const copy = useCopy(NOTES_COPY).editor;
  const linksCopy = useCopy(LINKS_COPY).completion;
  const { cache, mutate } = useSWRConfig();
  const { toast } = useToast();
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // The failure itself, not its text, so a language switch re-renders the message.
  const [uploadFailure, setUploadFailure] = useState<{ error: unknown } | null>(null);
  const baseExtensions = useMemo(() => [
    markdown(),
    ...wikiLinkCompletion(fetchNoteTitles),
    EditorView.lineWrapping,
    syntaxHighlighting(writingHighlight),
    // Highest precedence: the light/dark base theme comes first in the extension list and would otherwise win.
    Prec.highest(EditorView.theme({
      "&": { backgroundColor: "var(--card)", color: "var(--ink)" },
      ".cm-scroller": { fontFamily: "var(--font-sans)", fontSize: "var(--text-read-size)", lineHeight: "var(--text-read-leading)" },
      // lineWrapping resets word-break; restore the global Korean rule so words never split mid-syllable.
      ".cm-content, .cm-lineWrapping": { wordBreak: "keep-all", overflowWrap: "anywhere" },
      ".cm-content": { minHeight: "24rem", padding: "1rem 1.25rem", caretColor: "var(--accent)" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
      "&.cm-focused": { outline: "none" },
    })),
  ], []);
  // The link is already in the body; get-or-create never duplicates a note the title list did not show (archived).
  const createLinkedNote = useCallback(async (title: string) => {
    try {
      await api<{ note: NoteRef }>("/api/notes/by-title", { method: "POST", json: { title } });
    } catch {
      toast(textInEveryLocale((locale) => LINKS_COPY[locale].completion.createFailed(title)), { tone: "danger" });
      return;
    }
    await refreshNoteViews({ cache, mutate });
  }, [cache, mutate, toast]);
  // A new list reconfigures the live editor in place, as a theme change does; text, selection and undo history stay.
  const extensions = useMemo(() => [
    ...baseExtensions,
    EditorState.phrases.of(copy.phrases),
    EditorView.contentAttributes.of({ "aria-label": copy.bodyLabel }),
    wikiLinkEnv.of({ createLabel: linksCopy.create, onCreate: (title) => void createLinkedNote(title) }),
  ], [baseExtensions, copy, linksCopy, createLinkedNote]);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadFailure(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("noteId", noteId);
      const attachment = await api<{ markdown: string }>("/api/attachments", { method: "POST", body: form });
      const view = editorRef.current?.view;
      if (view) {
        const at = view.state.selection.main.head;
        view.dispatch({ changes: { from: at, insert: attachmentMarkdownAt(view.state.doc.toString(), at, attachment.markdown) } });
        view.focus();
      } else {
        onAppend(attachment.markdown);
      }
    } catch (error) {
      setUploadFailure({ error });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="overflow-hidden rounded-card border border-line bg-card focus-within:ring-2 focus-within:ring-accent/30">
      <div className="flex items-center justify-between border-b border-line bg-desk px-3 py-2">
        <span className="text-xs text-mute">{copy.hint}</span>
        <Button size="sm" className="min-h-touch sm:min-h-0" variant="ghost" loading={uploading} leading={<Paperclip aria-hidden className="size-4" />} onClick={() => fileRef.current?.click()}>
          {copy.attach}
        </Button>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          aria-label={copy.attachLabel}
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}
        />
      </div>
      {uploadFailure ? <p role="alert" className="border-b border-line bg-danger-soft px-3 py-2 text-sm text-danger">{localizedApiError(uploadFailure.error, locale, copy.uploadFailed)}</p> : null}
      {/* Dark keeps One Dark's editor chrome (selection, panels, tooltips) but not its code-syntax colours. */}
      <CodeMirror ref={editorRef} value={value} theme={resolvedTheme === "dark" ? oneDarkTheme : "light"} extensions={extensions} onChange={onChange} basicSetup={BASIC_SETUP} />
    </div>
  );
}
