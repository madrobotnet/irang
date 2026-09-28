"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Button } from "./Button";
import { cn } from "./cn";

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Element to focus when the modal opens (defaults to the first focusable inside). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Hide the visible title while keeping it as the accessible name. */
  hideTitle?: boolean;
  className?: string;
  bodyClassName?: string;
};

/**
 * Controlled native <dialog>. The browser supplies the focus trap (everything
 * outside is inert), Escape handling and focus restore on close; this hook
 * keeps it in sync with React state and locks page scroll while open.
 */
export function useModalDialog(open: boolean, onOpenChange: (open: boolean) => void, initialFocusRef?: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      openerRef.current = document.activeElement;
      node.showModal();
      const target = initialFocusRef?.current;
      if (target) target.focus();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const onClose = useCallback(() => {
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    onOpenChange(false);
  }, [onOpenChange]);

  const onBackdropClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }, []);

  return { ref, onClose, onBackdropClick };
}

const DIALOG_BASE =
  "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden p-0 text-ink backdrop:bg-scrim " +
  "surface-card shadow-pop open:flex open:flex-col";

export type DialogProps = ModalProps & { size?: "sm" | "md" | "lg" };

const DIALOG_SIZE = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" } as const;

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  hideTitle,
  size = "md",
  className,
  bodyClassName,
}: DialogProps) {
  const { ref, onClose, onBackdropClick } = useModalDialog(open, onOpenChange, initialFocusRef);
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={onBackdropClick}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className={cn(DIALOG_BASE, DIALOG_SIZE[size], className)}
    >
      {open ? (
        <>
          {title || !hideTitle ? (
            <header className={cn("flex items-start gap-3 px-5 pt-4", hideTitle ? "sr-only" : "pb-2")}>
              <div className="min-w-0 flex-1">
                {title ? (
                  <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p id={descId} className="mt-0.5 text-sm text-mute">
                    {description}
                  </p>
                ) : null}
              </div>
              {!hideTitle ? (
                <Button variant="ghost" size="sm" iconOnly aria-label="닫기" onClick={() => onOpenChange(false)} className="-mr-2 -mt-1">
                  <X className="size-4" />
                </Button>
              ) : null}
            </header>
          ) : null}
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3 scrollbar-thin", bodyClassName)}>{children}</div>
          {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
        </>
      ) : null}
    </dialog>
  );
}

export type SheetProps = ModalProps;

/** Bottom sheet for mobile menus; on wide screens it becomes a narrow centered card. */
export function Sheet({ open, onOpenChange, title, description, children, footer, initialFocusRef, hideTitle, className, bodyClassName }: SheetProps) {
  const { ref, onClose, onBackdropClick } = useModalDialog(open, onOpenChange, initialFocusRef);
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      ref={ref}
      data-sheet
      onClose={onClose}
      onClick={onBackdropClick}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-md overflow-hidden rounded-t-card border border-b-0 border-line bg-card p-0 text-ink shadow-pop backdrop:bg-scrim open:flex open:flex-col",
        "sm:mb-auto sm:rounded-card sm:border-b",
        className,
      )}
    >
      {open ? (
        <>
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-pill bg-line-strong sm:hidden" />
          <header className={cn("flex items-start gap-3 px-4 pt-3", hideTitle ? "sr-only" : "pb-1")}>
            <div className="min-w-0 flex-1">
              {title ? (
                <h2 id={titleId} className="text-md font-semibold">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descId} className="text-sm text-mute">
                  {description}
                </p>
              ) : null}
            </div>
            {!hideTitle ? (
              <Button variant="ghost" size="sm" iconOnly aria-label="닫기" onClick={() => onOpenChange(false)} className="-mr-1">
                <X className="size-4" />
              </Button>
            ) : null}
          </header>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-2 pb-2 pb-safe scrollbar-thin", bodyClassName)}>{children}</div>
          {footer ? <footer className="border-t border-line px-4 py-3 pb-safe">{footer}</footer> : null}
        </>
      ) : null}
    </dialog>
  );
}
