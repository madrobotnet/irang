"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import styles from "@/components/notes/notes.module.css";

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  async function send(event: FormEvent) {
    event.preventDefault();
    setError("");
    const created = await fetch("/api/chat/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: question.slice(0, 40) || "대화" }),
    });
    if (!created.ok) {
      setError("대화를 시작하지 못했습니다");
      return;
    }
    const thread = await created.json() as { id?: string };
    if (thread.id === undefined) return;
    const response = await fetch(`/api/chat/threads/${thread.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (response.status === 503) {
      const payload = await response.json() as { error?: string };
      setError(payload.error === "codex_misconfigured" ? "대화 설정을 찾을 수 없습니다" : "판단 설정을 찾을 수 없습니다");
      return;
    }
    const payload = await response.json() as { body?: string };
    setAnswer(payload.body ?? "");
  }

  return (
    <main className={styles["page"]}>
      <header className={styles["heading"]}>
        <h1 className={styles["title"]}>AI 채팅</h1>
        <Link href="/search">검색</Link>
      </header>
      <form onSubmit={send}>
        <label className={styles["field"]}>
          질문
          <textarea className={styles["textarea"]} value={question} onChange={(event) => setQuestion(event.target.value)} required />
        </label>
        <button className={styles["button"]} type="submit">보내기</button>
      </form>
      {error === "" ? null : <p>{error}</p>}
      {answer === "" ? null : <p>{answer}</p>}
    </main>
  );
}
