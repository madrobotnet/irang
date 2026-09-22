"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/notes/notes.module.css";

type TrashNote = { readonly id: string; readonly title: string };

export default function TrashPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<readonly TrashNote[]>([]);

  useEffect(() => {
    void fetch("/api/notes/trash").then(async (response) => {
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const payload: unknown = await response.json();
      if (payload !== null && typeof payload === "object" && "notes" in payload && Array.isArray(payload.notes)) {
        setNotes(payload.notes.flatMap((note) => {
          if (note === null || typeof note !== "object" || !("id" in note) || !("title" in note)) return [];
          return [{ id: String(note.id), title: String(note.title) }];
        }));
      }
    });
  }, [router]);

  async function restore(id: string) {
    const response = await fetch(`/api/notes/${id}/restore`, { method: "POST" });
    if (response.ok) setNotes((current) => current.filter((note) => note.id !== id));
  }

  return (
    <main className={styles["page"]}>
      <header className={styles["heading"]}>
        <h1 className={styles["title"]}>휴지통</h1>
        <Link href="/notes">노트</Link>
      </header>
      <ul className={styles["list"]}>
        {notes.map((note) => (
          <li key={note.id} className={styles["card"]}>
            <span>{note.title}</span>
            <button className={styles["button"]} type="button" onClick={() => void restore(note.id)}>복구</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
