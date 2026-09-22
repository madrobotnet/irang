import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NoteEditor } from "@/components/notes/note-editor";
import styles from "@/components/notes/notes.module.css";
import { resolveSession, SESSION_COOKIE } from "@/lib/auth/session";
import { listActiveNotes } from "@/lib/notes/store";

export default async function NotesPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token === undefined || await resolveSession(token) === null) redirect("/login");
  const notes = await listActiveNotes();
  return (
    <main className={styles["page"]}>
      <header className={styles["heading"]}>
        <h1 className={styles["title"]}>노트</h1>
        <Link href="/notes/trash">휴지통</Link>
      </header>
      <p>새 노트</p>
      <NoteEditor />
      <ul className={styles["list"]}>
        {notes.map((note) => (
          <li key={note.id}>
            <Link className={styles["card"]} href={`/notes/${note.id}`}>{note.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
