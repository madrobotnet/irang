"use client";

import { useEffect, useRef, useState } from "react";
import { lockedMessage } from "./login-copy";
import styles from "./LockCountdown.module.css";

function formatParts(totalSeconds: number): { mm: string; ss: string } {
  const clamped = Math.max(0, totalSeconds);
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return { mm, ss };
}

type LockCountdownProps = {
  initialSeconds: number;
  onExpire: () => void;
};

export function LockCountdown({ initialSeconds, onExpire }: LockCountdownProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil(initialSeconds)),
  );
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(Math.max(0, Math.ceil(initialSeconds)));
    expiredRef.current = false;
  }, [initialSeconds]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current();
    }
  }, [remaining]);

  const { mm, ss } = formatParts(remaining);

  return (
    <p
      className={styles.locked}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {lockedMessage(mm, ss)}
    </p>
  );
}
