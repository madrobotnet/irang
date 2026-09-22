"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/login/login.module.css";

const errors: Record<number, string> = {
  401: "비밀번호가 올바르지 않습니다",
  423: "잠시 후 다시 시도해 주세요",
  503: "인증 설정이 없습니다",
};
const retryMessage = "잠시 후 다시 시도해 주세요";

export default function LoginForm() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [invalidPassword, setInvalidPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const password = new FormData(event.currentTarget).get("password");
    inFlight.current = true;
    setPending(true);
    setError("");
    setInvalidPassword(false);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.status === 200) {
        router.replace("/");
        router.refresh();
        return;
      }
      setInvalidPassword(response.status === 401);
      setError(errors[response.status] ?? retryMessage);
    } catch {
      setError(retryMessage);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form className={styles["form"]} onSubmit={submit} aria-busy={pending}>
      <label className={styles["label"]} htmlFor="password">비밀번호</label>
      <input
        className={styles["input"]}
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        readOnly={pending}
        aria-invalid={invalidPassword}
        aria-describedby="login-error"
        onChange={() => {
          setError("");
          setInvalidPassword(false);
        }}
      />
      <p id="login-error" className={styles["error"]} aria-live="polite" aria-atomic="true">{error}</p>
      <button className={styles["submit"]} type="submit" disabled={pending}>들어가기</button>
    </form>
  );
}
