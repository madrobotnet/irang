"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import type { Locale, LocalizedText } from "@/lib/i18n/locale";
import { cn } from "./cn";
import { UI_COPY } from "./copy";

export type ToastTone = "info" | "ok" | "danger";

/**
 * Retained UI text carries every locale, so a toast that stays open follows a language switch.
 */
export type ToastText = LocalizedText;

export function toastText(text: ToastText, locale: Locale): string {
  return text[locale];
}

export type ToastOptions = {
  tone?: ToastTone;
  /** Optional single action (e.g. undo). */
  action?: { label: ToastText; onClick: () => void };
  /** Milliseconds before auto-dismiss; 0 keeps it until closed. */
  durationMs?: number;
};

export type ToastItem = ToastOptions & { id: number; message: ToastText };

export type ToastContextValue = {
  toast: (message: ToastText, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, typeof Info> = { info: Info, ok: CircleCheck, danger: CircleAlert };
const TONE_TEXT: Record<ToastTone, string> = { info: "text-mute", ok: "text-ok", danger: "text-danger" };

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { locale } = useLocale();
  const copy = useCopy(UI_COPY);
  const tone = item.tone ?? "info";
  const Icon = TONE_ICON[tone];
  const duration = item.durationMs ?? (item.action ? 6000 : 3500);
  useEffect(() => {
    if (duration <= 0) return;
    const handle = window.setTimeout(() => onDismiss(item.id), duration);
    return () => window.clearTimeout(handle);
  }, [duration, item.id, onDismiss]);

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-2.5 rounded-card border border-line bg-card px-3.5 py-2.5 text-base text-ink shadow-pop",
        "motion-safe:animate-[sb-toast-in_180ms_var(--ease-out-soft)]",
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone])} />
      <p className="min-w-0 flex-1 leading-snug">{toastText(item.message, locale)}</p>
      {item.action ? (
        <button
          type="button"
          className="shrink-0 rounded-ctl px-1.5 py-0.5 text-sm font-semibold text-accent hover:bg-accent-soft focus-ring"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
        >
          {toastText(item.action.label, locale)}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={copy.dismissToast}
        className="-mr-1 shrink-0 rounded-ctl p-1 text-mute hover:bg-line/60 hover:text-ink focus-ring"
        onClick={() => onDismiss(item.id)}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback((message: ToastText, options?: ToastOptions) => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-3), { id, message, ...options }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4",
          "bottom-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom,0px)+0.75rem)] lg:bottom-4 lg:items-end lg:px-6",
        )}
      >
        {items.map((item) => (
          <div key={item.id} className="w-full max-w-sm">
            <ToastCard item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
