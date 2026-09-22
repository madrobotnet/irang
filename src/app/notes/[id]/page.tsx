import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NoteEditor } from "@/components/notes/note-editor";
import styles from "@/components/notes/notes.module.css";
import { resolveSession, SESSION_COOKIE } from "@/lib/auth/session";
import { parseNoteId } from "@/lib/notes/schema";
import { getActiveNote } from "@/lib/notes/store";

export default async function NotePage({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token === undefined || await resolveSession(token) === null) redirect("/login");
  const id = parseNoteId((await params).id);
  if (id === undefined) notFound();
  const note = await getActiveNote(id);
  if (note === null) notFound();
  return (
    <main>
      <p className={styles["page"]}><Link href="/notes">노트</Link></p>
      <NoteEditor noteId={note.id} initialTitle={note.title} initialBody={note.body} />
    </main>
  );
}
