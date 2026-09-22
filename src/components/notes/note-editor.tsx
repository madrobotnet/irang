"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./notes.module.css";

export function NoteEditor({
  noteId,
  initialTitle = "",
  initialBody = "",
}: {
  readonly noteId?: string;
  readonly initialTitle?: string;
  readonly initialBody?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(noteId === undefined ? "/api/notes" : `/api/notes/${noteId}`, {
      method: noteId === undefined ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (!response.ok) {
      setError("저장하지 못했습니다");
      return;
    }
    const payload: unknown = await response.json();
    const id = payload !== null && typeof payload === "object" && "note" in payload
      && payload.note !== null && typeof payload.note === "object" && "id" in payload.note
      ? String(payload.note.id)
      : noteId;
    router.push(id === undefined ? "/notes" : `/notes/${id}`);
    router.refresh();
  }

  async function remove() {
    if (noteId === undefined) return;
    const response = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    if (response.ok) router.push("/notes");
  }

  return (
    <form className={styles["page"]} onSubmit={save}>
      <label className={styles["field"]}>
        제목
        <input className={styles["input"]} value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label className={styles["field"]}>
        본문
        <textarea className={styles["textarea"]} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      {error === "" ? null : <p>{error}</p>}
      <div className={styles["actions"]}>
        <button className={styles["button"]} type="submit">저장</button>
        {noteId === undefined ? null : <button className={`${styles["button"]} ${styles["quiet"]}`} type="button" onClick={remove}>삭제</button>}
      </div>
    </form>
  );
}
