"use client";

import { useEffect, useState } from "react";
import { validateCaptureFile } from "@/lib/capture/validation";
import type { CaptureJudgmentPayload } from "@/lib/jev/capture-types";
import { applyTagSuggestions } from "@/lib/jev/apply-tag-suggestions";
import { derivePostCaptureJevState } from "@/lib/jev/jev-state";
import type { CaptureTarget } from "@/lib/notes/client-api";
import { submitCapture } from "@/lib/notes/client-api";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { JEV_COPY } from "@/components/jev/copy";
import { CaptureJevPanel } from "./CaptureJevPanel";
import { CAPTURE_COPY } from "./copy";
import styles from "./CaptureSheet.module.css";

type SheetState =
  | "idle"
  | "uploading"
  | "error_mime"
  | "error_size"
  | "error_network"
  | "error_ingest"
  | "error_jev"
  | "error_key_missing"
  | "post_capture";

type CaptureSuccess = {
  target: CaptureTarget;
  noteId?: string;
  inboxItemId?: string;
  duplicateHint: boolean;
  judgments: CaptureJudgmentPayload;
};

type CaptureSheetProps = {
  open: boolean;
  defaultMode: CaptureTarget;
  onClose: () => void;
};

export function CaptureSheet({ open, defaultMode, onClose }: CaptureSheetProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<CaptureTarget>(defaultMode);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>("idle");
  const [captureSuccess, setCaptureSuccess] = useState<CaptureSuccess | null>(null);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setSheetState("idle");
      setCaptureSuccess(null);
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

  const formLocked = sheetState === "uploading" || sheetState === "post_capture";
  const canSubmit =
    sheetState !== "uploading" &&
    sheetState !== "post_capture" &&
    title.trim().length > 0 &&
    body.trim().length > 0;

  const resetForm = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setFile(null);
    setSheetState("idle");
    setCaptureSuccess(null);
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

  const finishCaptureSuccess = (target: CaptureTarget) => {
    showToast(target === "note" ? CAPTURE_COPY.successNote : CAPTURE_COPY.successInbox);
    resetForm();
    onClose();
  };

  const afterCaptureSuccess = (success: CaptureSuccess) => {
    const hasJevUi =
      success.duplicateHint ||
      success.judgments.suggestions.tags.length > 0 ||
      derivePostCaptureJevState(success.judgments) !== "jev_idle";

    if (hasJevUi) {
      setCaptureSuccess(success);
      setSheetState("post_capture");
      return;
    }
    finishCaptureSuccess(success.target);
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
      target: mode,
      title: title.trim(),
      body: body.trim(),
      url: url.trim() || undefined,
      file,
    });

    if (!result.ok) {
      if (result.reason === "unsupported_media") {
        setSheetState("error_mime");
        return;
      }
      if (result.reason === "payload_too_large") {
        setSheetState("error_size");
        return;
      }
      if (result.reason === "ingest_failed") {
        setSheetState("error_ingest");
        return;
      }
      if (result.reason === "jev_error") {
        setSheetState("error_jev");
        return;
      }
      if (result.reason === "key_missing") {
        setSheetState("error_key_missing");
        return;
      }
      setSheetState("error_network");
      return;
    }

    afterCaptureSuccess({
      target: result.target,
      noteId: result.noteId,
      inboxItemId: result.inboxItemId,
      duplicateHint: result.duplicateHint,
      judgments: result.judgments,
    });
  };

  const handleApplyTags = async (tags: string[]) => {
    if (!captureSuccess) return;
    await applyTagSuggestions({
      tags,
      noteId: captureSuccess.noteId,
      inboxItemId: captureSuccess.inboxItemId,
    });
    showToast("제안 태그를 적용했어요");
    finishCaptureSuccess(captureSuccess.target);
  };

  const handleSkipTags = () => {
    if (!captureSuccess) return;
    finishCaptureSuccess(captureSuccess.target);
  };

  const handleDuplicateChoice = (choice: "merge" | "version" | "cancel") => {
    if (!captureSuccess) return;
    if (choice === "cancel") {
      setSheetState("post_capture");
      return;
    }
    showToast(choice === "merge" ? "합쳤어요" : "새 버전으로 남겼어요");
    finishCaptureSuccess(captureSuccess.target);
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

        {sheetState === "error_jev" ? (
          <ErrorBanner
            message={JEV_COPY.jevErrorRetry}
            onRetry={() => void handleSubmit()}
            retryLabel={CAPTURE_COPY.retry}
          />
        ) : null}

        {sheetState === "error_key_missing" ? (
          <ErrorBanner message={JEV_COPY.keyMissing} />
        ) : null}

        {sheetState === "error_network" ? (
          <ErrorBanner
            message={CAPTURE_COPY.networkError}
            onRetry={() => void handleSubmit()}
            retryLabel={CAPTURE_COPY.retry}
          />
        ) : null}

        {sheetState === "error_ingest" ? (
          <ErrorBanner
            message={CAPTURE_COPY.ingestError}
            onRetry={() => void handleSubmit()}
            retryLabel={CAPTURE_COPY.retry}
          />
        ) : null}

        {sheetState === "post_capture" && captureSuccess ? (
          <CaptureJevPanel
            judgments={captureSuccess.judgments}
            duplicateHint={captureSuccess.duplicateHint}
            onApplyTags={(tags) => void handleApplyTags(tags)}
            onSkipTags={handleSkipTags}
            onDuplicateChoice={handleDuplicateChoice}
          />
        ) : (
          <>
            <div className={styles.modeToggle} role="group" aria-label="캡처 모드">
              <button
                type="button"
                className={mode === "inbox" ? styles.modeActive : styles.mode}
                onClick={() => setMode("inbox")}
                disabled={formLocked}
              >
                {CAPTURE_COPY.modeInbox}
              </button>
              <button
                type="button"
                className={mode === "note" ? styles.modeActive : styles.mode}
                onClick={() => setMode("note")}
                disabled={formLocked}
              >
                {CAPTURE_COPY.modeNote}
              </button>
            </div>

            <label className={styles.field}>
              <span>{CAPTURE_COPY.titleLabel}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={formLocked}
                required
              />
            </label>

            <label className={styles.field}>
              <span>{CAPTURE_COPY.bodyLabel}</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={formLocked}
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
                disabled={formLocked}
                placeholder="https://"
              />
              <span className={styles.hint}>{CAPTURE_COPY.urlHint}</span>
            </label>

            <label className={styles.field}>
              <span>{CAPTURE_COPY.fileLabel}</span>
              <input
                type="file"
                disabled={formLocked}
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
