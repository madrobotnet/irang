"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGIN_COPY } from "./login-copy";
import { LockCountdown } from "./LockCountdown";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { submitLogin } from "@/lib/login/client-api";
import styles from "./LoginForm.module.css";

export type LoginUiState =
  | "idle"
  | "submitting"
  | "error"
  | "locked"
  | "success";

export function LoginForm() {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginUiState>("idle");
  const [lockedSeconds, setLockedSeconds] = useState(0);
  const [showEmptyHint, setShowEmptyHint] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [opsMessage, setOpsMessage] = useState<string | null>(null);
  const [networkVisible, setNetworkVisible] = useState(false);

  const canSubmit =
    password.length > 0 && state !== "submitting" && state !== "locked";

  const runSubmit = useCallback(async () => {
    if (!password.trim()) {
      setShowEmptyHint(true);
      return;
    }
    setShowEmptyHint(false);
    setPasswordError(false);
    setOpsMessage(null);
    setNetworkVisible(false);
    setState("submitting");

    const result = await submitLogin(password);

    if (result.kind === "success") {
      setState("success");
      router.replace("/");
      return;
    }

    if (result.kind === "invalid_password") {
      setState("error");
      setPasswordError(true);
      passwordRef.current?.focus();
      return;
    }

    if (result.kind === "locked") {
      setLockedSeconds(result.retryAfterSeconds);
      setState("locked");
      return;
    }

    if (result.kind === "misconfigured") {
      setState("idle");
      setOpsMessage(LOGIN_COPY.misconfigured);
      return;
    }

    setState("idle");
    setNetworkVisible(true);
  }, [password, router]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    void runSubmit();
  };

  const onNetworkRetry = () => {
    setNetworkVisible(false);
    void runSubmit();
  };

  const onLockExpire = useCallback(() => {
    setState("idle");
    setLockedSeconds(0);
    passwordRef.current?.focus();
  }, []);

  const fieldDisabled = state === "submitting" || state === "locked";
  const ctaDisabled = !canSubmit;

  return (
    <div className={styles.wrap}>
      {networkVisible ? (
        <div className={styles.bannerSlot}>
          <ErrorBanner
            message={LOGIN_COPY.network}
            onRetry={onNetworkRetry}
          />
        </div>
      ) : null}

      <header className={styles.header}>
        <div className={styles.logo} aria-hidden="true">SB</div>
        <h1 className={styles.title}>{LOGIN_COPY.title}</h1>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <label className={styles.label} htmlFor="login-password">
          {LOGIN_COPY.passwordLabel}
        </label>
        <input
          ref={passwordRef}
          id="login-password"
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          disabled={fieldDisabled}
          onChange={(e) => {
            setPassword(e.target.value);
            if (e.target.value) setShowEmptyHint(false);
            if (state === "error") {
              setPasswordError(false);
              setState("idle");
            }
          }}
          aria-invalid={passwordError || showEmptyHint}
          aria-describedby={
            passwordError
              ? "login-password-error"
              : showEmptyHint
                ? "login-empty-hint"
                : undefined
          }
        />

        {showEmptyHint ? (
          <p id="login-empty-hint" className={styles.hint} role="status">
            {LOGIN_COPY.empty}
          </p>
        ) : null}

        {passwordError ? (
          <p
            id="login-password-error"
            className={styles.fieldError}
            role="alert"
            aria-live="polite"
          >
            {LOGIN_COPY.badPassword}
          </p>
        ) : null}

        {opsMessage ? (
          <p className={styles.ops} role="alert">{opsMessage}</p>
        ) : null}

        {state === "locked" ? (
          <LockCountdown
            initialSeconds={lockedSeconds}
            onExpire={onLockExpire}
          />
        ) : null}

        <button
          type="submit"
          className={styles.cta}
          disabled={ctaDisabled}
          aria-busy={state === "submitting"}
        >
          {state === "submitting" ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : null}
          <span>{LOGIN_COPY.cta}</span>
        </button>
      </form>
    </div>
  );
}
