"use client";

import { useEffect, useState } from "react";
import { validateCaptureFile } from "@/lib/capture/validation";
import type { CaptureMode } from "@/lib/notes/client-api";
import { submitCapture } from "@/lib/notes/client-api";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { CAPTURE_COPY } from "./copy";
import styles from "./CaptureSheet.module.css";

type SheetState =
  | "idle"
  | "uploading"
  | "error_mime"
  | "error_size"
  | "error_network"
  | "duplicate";

type CaptureSheetProps = {
  open: boolean;
  defaultMode: CaptureMode;
  onClose: () => void;
};

export function CaptureSheet({ open, defaultMode, onClose }: CaptureSheetProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<CaptureMode>(defaultMode);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>("idle");

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setSheetState("idle");
    }
  }, [open, defaultMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sheetState !== "uploading") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, sheetState]);

  const disabled = sheetState === "uploading" || sheetState === "duplicate";
  const canSubmit =
    !disabled && title.trim().length > 0 && body.trim().length > 0;

  const resetForm = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setFile(null);
    setSheetState("idle");
  };

  const handleClose = () => {
    if (sheetState === "uploading") return;
    resetForm();
    onClose();
  };

  const handleFileChange = (next: File | null) => {
    if (!next) {
      setFile(null);
      if (sheetState === "error_mime" || sheetState === "error_size") {
        setSheetState("idle");
      }
      return;
    }
    const result = validateCaptureFile(next);
    if (!result.ok) {
      setFile(next);
      setSheetState(result.reason === "mime" ? "error_mime" : "error_size");
      return;
    }
    setFile(next);
    if (sheetState === "error_mime" || sheetState === "error_size") {
      setSheetState("idle");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (file) {
      const check = validateCaptureFile(file);
      if (!check.ok) {
        setSheetState(check.reason === "mime" ? "error_mime" : "error_size");
        return;
      }
    }

    setSheetState("uploading");
    const result = await submitCapture({
      mode,
      title: title.trim(),
      body: body.trim(),
      url: url.trim() || undefined,
      file,
    });

    if (!result.ok) {
      if (result.reason === "duplicate") {
        setSheetState("duplicate");
        return;
      }
      setSheetState("error_network");
      return;
    }

    showToast(
      result.target === "note" ? CAPTURE_COPY.successNote : CAPTURE_COPY.successInbox,
    );
    resetForm();
    onClose();
  };

  const handleDuplicateChoice = (choice: "merge" | "version" | "cancel") => {
    if (choice === "cancel") {
      setSheetState("idle");
      return;
    }
    showToast(
      choice === "merge"
        ? "합쳤어요 (API 연동 대기)"
        : "새 버전으로 저장했어요 (API 연동 대기)",
    );
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={handleClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="capture-sheet-title" className={styles.heading}>
            {CAPTURE_COPY.title}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={handleClose}
            disabled={sheetState === "uploading"}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        {sheetState === "error_network" ? (
          <ErrorBanner
            message={CAPTURE_COPY.networkError}
            onRetry={() => void handleSubmit()}
            retryLabel={CAPTURE_COPY.retry}
          />
        ) : null}

        {sheetState === "duplicate" ? (
          <div className={styles.duplicate} role="status">
            <p className={styles.duplicateLead}>{CAPTURE_COPY.duplicateTitle}</p>
            <div className={styles.duplicateActions}>
              <button type="button" onClick={() => handleDuplicateChoice("merge")}>
                {CAPTURE_COPY.merge}
              </button>
              <button type="button" onClick={() => handleDuplicateChoice("version")}>
                {CAPTURE_COPY.newVersion}
              </button>
              <button type="button" onClick={() => handleDuplicateChoice("cancel")}>
                {CAPTURE_COPY.cancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.modeToggle} role="group" aria-label="캡처 모드">
              <button
                type="button"
                className={mode === "inbox" ? styles.modeActive : styles.mode}
                onClick={() => setMode("inbox")}
                disabled={disabled}
              >
                {CAPTURE_COPY.modeInbox}
              </button>
              <button
                type="button"
                className={mode === "note" ? styles.modeActive : styles.mode}
                onClick={() => setMode("note")}
                disabled={disabled}
              >
                {CAPTURE_COPY.modeNote}
              </button>
            </div>

            <label className={styles.field}>
              <span>{CAPTURE_COPY.titleLabel}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={disabled}
                required
              />
            </label>

            <label className={styles.field}>
              <span>{CAPTURE_COPY.bodyLabel}</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={disabled}
                required
                rows={5}
              />
            </label>

            <label className={styles.field}>
              <span>{CAPTURE_COPY.urlLabel}</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={disabled}
                placeholder="https://"
              />
              <span className={styles.hint}>{CAPTURE_COPY.urlHint}</span>
            </label>

            <label className={styles.field}>
              <span>{CAPTURE_COPY.fileLabel}</span>
              <input
                type="file"
                disabled={disabled}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                accept=".md,.pdf,.png,.jpg,.jpeg,.zip,.mp3,.mp4"
              />
              {sheetState === "error_mime" ? (
                <span className={styles.inlineError} role="alert" aria-live="polite">
                  {CAPTURE_COPY.mime}
                </span>
              ) : null}
              {sheetState === "error_size" ? (
                <span className={styles.inlineError} role="alert" aria-live="polite">
                  {CAPTURE_COPY.size}
                </span>
              ) : null}
            </label>

            <button
              type="button"
              className={styles.submit}
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              aria-busy={sheetState === "uploading"}
            >
              {sheetState === "uploading"
                ? "보내는 중…"
                : mode === "inbox"
                  ? CAPTURE_COPY.ctaInbox
                  : CAPTURE_COPY.ctaNote}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
