"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/notes/notes.module.css";

type Item = { readonly id: string; readonly title: string; readonly body: string };
type Suggestion = { readonly id: string; readonly label: string; readonly probability: number | null; readonly status: string };
type Job = { readonly id: string; readonly kind: string; readonly error: string | null; readonly attempts: number };

export default function InboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<readonly Item[]>([]);
  const [suggestions, setSuggestions] = useState<Readonly<Record<string, readonly Suggestion[]>>>({});
  const [jobs, setJobs] = useState<readonly Job[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/inbox");
    if (response.status === 401) {
      router.replace("/login");
      return;
    }
    const payload: unknown = await response.json();
    if (payload !== null && typeof payload === "object" && "items" in payload && Array.isArray(payload.items)) {
      setItems(payload.items.flatMap((item) => {
        if (item === null || typeof item !== "object" || !("id" in item) || !("title" in item)) return [];
        return [{ id: String(item.id), title: String(item.title), body: "body" in item ? String(item.body) : "" }];
      }));
    }
    const jobsResponse = await fetch("/api/jobs");
    const jobsPayload: unknown = await jobsResponse.json();
    if (jobsPayload !== null && typeof jobsPayload === "object" && "jobs" in jobsPayload && Array.isArray(jobsPayload.jobs)) {
      setJobs(jobsPayload.jobs.flatMap((job) => {
        if (job === null || typeof job !== "object" || !("id" in job)) return [];
        return [{
          id: String(job.id),
          kind: "kind" in job ? String(job.kind) : "",
          error: "error" in job && job.error !== null ? String(job.error) : null,
          attempts: "attempts" in job ? Number(job.attempts) : 0,
        }];
      }));
    }
  }

  useEffect(() => { void load(); }, [router]);

  async function promote(id: string) {
    const response = await fetch(`/api/inbox/${id}/promote`, { method: "POST" });
    if (response.ok) await load();
  }

  async function discard(id: string) {
    const response = await fetch(`/api/inbox/${id}/discard`, { method: "POST" });
    if (response.ok) await load();
  }

  async function suggest(id: string) {
    const response = await fetch(`/api/inbox/${id}/suggest`, { method: "POST" });
    if (response.status === 503) {
      setError("판단 설정을 찾을 수 없습니다");
      return;
    }
    const payload: unknown = await response.json();
    if (payload !== null && typeof payload === "object" && "suggestions" in payload && Array.isArray(payload.suggestions)) {
      setSuggestions((current) => ({ ...current, [id]: payload.suggestions as Suggestion[] }));
    }
  }

  async function apply(id: string) {
    const response = await fetch(`/api/judgments/${id}/apply`, { method: "POST" });
    if (!response.ok) setError("먼저 노트로 올린 뒤 적용하세요");
  }

  async function retry(id: string) {
    await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
    await load();
  }

  return (
    <main className={styles["page"]}>
      <header className={styles["heading"]}>
        <h1 className={styles["title"]}>받은 편지함</h1>
        <Link href="/notes">노트</Link>
      </header>
      {error === "" ? null : <p>{error}</p>}
      <ul className={styles["list"]}>
        {items.map((item) => (
          <li key={item.id} className={styles["card"]}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <div className={styles["actions"]}>
              <button className={styles["button"]} type="button" onClick={() => void promote(item.id)}>노트로 올리기</button>
              <button className={`${styles["button"]} ${styles["quiet"]}`} type="button" onClick={() => void discard(item.id)}>버리기</button>
              <button className={`${styles["button"]} ${styles["quiet"]}`} type="button" onClick={() => void suggest(item.id)}>제안</button>
            </div>
            <ul>
              {(suggestions[item.id] ?? []).map((suggestion) => (
                <li key={suggestion.id}>
                  {suggestion.label}
                  {suggestion.probability === null ? "" : ` ${Math.round(suggestion.probability * 100)}%`}
                  <button type="button" onClick={() => void apply(suggestion.id)}>적용</button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <h2>실패한 작업</h2>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            {job.kind} {job.error} ({job.attempts})
            <button type="button" onClick={() => void retry(job.id)}>다시 시도</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
