"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import styles from "./DeskCommandBar.module.css";

export type DeskCommandBarProps = {
  value?: string;
  placeholder: string;
  label?: string;
  filled?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  kbdHint?: "cmd-k" | "esc";
};

export function DeskCommandBar({
  value = "",
  placeholder,
  label = "검색 · 커맨드",
  onChange,
  onSubmit,
  onEscape,
  autoFocus,
  kbdHint = "cmd-k",
}: DeskCommandBarProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        if (onChange || onSubmit) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        onEscape?.();
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChange, onEscape, onSubmit]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <section className={styles.surface} aria-label={label}>
      <span className={styles.label}>{label}</span>
      <form className={styles.row} onSubmit={submit} role="search">
        <div className={styles.bar} data-desk-command-bar>
          <span className={styles.sparkle} aria-hidden="true">✦</span>
          {onChange || onSubmit ? (
            <input
              ref={inputRef}
              id={inputId}
              className={styles.input}
              type="search"
              value={value}
              placeholder={placeholder}
              autoFocus={autoFocus}
              autoComplete="off"
              onChange={(event) => onChange?.(event.target.value)}
            />
          ) : (
            <Link href="/search" className={styles.placeholderBtn}>
              {placeholder}
            </Link>
          )}
          <span className={styles.kbd} aria-hidden="true">
            {kbdHint === "esc" ? "Esc" : "⌘ K"}
          </span>
        </div>
      </form>
    </section>
  );
}
