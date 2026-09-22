"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import styles from "@/components/notes/notes.module.css";

type Hit = { readonly id: string; readonly title: string };
type Evidence = { readonly noteId: string; readonly probability: number };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [hits, setHits] = useState<readonly Hit[]>([]);
  const [indexStatus, setIndexStatus] = useState("");
  const [evidence, setEvidence] = useState<readonly Evidence[]>([]);
  const [error, setError] = useState("");

  async function search(event: FormEvent) {
    event.preventDefault();
    setError("");
    const params = new URLSearchParams({ q: query });
    if (tag.trim() !== "") params.set("tag", tag.trim());
    const response = await fetch(`/api/search?${params.toString()}`);
    if (response.status === 401) return;
    const payload: unknown = await response.json();
    if (payload !== null && typeof payload === "object" && "hits" in payload && Array.isArray(payload.hits)) {
      setHits(payload.hits.flatMap((hit) => {
        if (hit === null || typeof hit !== "object" || !("id" in hit) || !("title" in hit)) return [];
        return [{ id: String(hit.id), title: String(hit.title) }];
      }));
      setIndexStatus("indexStatus" in payload && payload.indexStatus === "indexing" ? "인덱싱 중" : "검색 준비됨");
    }
  }

  async function findEvidence() {
    setError("");
    const response = await fetch("/api/search/evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: query }),
    });
    if (response.status === 503) {
      setEvidence([]);
      setError("판단 설정을 찾을 수 없습니다");
      return;
    }
    const payload: unknown = await response.json();
    if (payload !== null && typeof payload === "object" && "evidence" in payload && Array.isArray(payload.evidence)) {
      setEvidence(payload.evidence.flatMap((item) => {
        if (item === null || typeof item !== "object" || !("noteId" in item) || !("probability" in item)) return [];
        return [{ noteId: String(item.noteId), probability: Number(item.probability) }];
      }));
    }
  }

  return (
    <main className={styles["page"]}>
      <header className={styles["heading"]}>
        <h1 className={styles["title"]}>검색</h1>
        <Link href="/notes">노트</Link>
      </header>
      <form onSubmit={search}>
        <label className={styles["field"]}>
          검색어
          <input className={styles["input"]} value={query} onChange={(event) => setQuery(event.target.value)} required />
        </label>
        <label className={styles["field"]}>
          태그
          <input className={styles["input"]} value={tag} onChange={(event) => setTag(event.target.value)} />
        </label>
        <div className={styles["actions"]}>
          <button className={styles["button"]} type="submit">찾기</button>
          <button className={`${styles["button"]} ${styles["quiet"]}`} type="button" onClick={() => void findEvidence()}>근거 노트</button>
        </div>
      </form>
      {indexStatus === "" ? null : <p>{indexStatus}</p>}
      {error === "" ? null : <p>{error}</p>}
      <ul className={styles["list"]}>
        {hits.map((hit) => <li key={hit.id}><Link href={`/notes/${hit.id}`}>{hit.title}</Link></li>)}
      </ul>
      <ul>
        {evidence.map((item) => (
          <li key={item.noteId}>{item.noteId} {Math.round(item.probability * 100)}%</li>
        ))}
      </ul>
    </main>
  );
}
