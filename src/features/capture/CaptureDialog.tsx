"use client";

/**
 * CONTRACT (owned by the inbox lane): quick-capture dialog.
 * The shell renders <CaptureDialog open onOpenChange /> and opens it from the
 * capture button, the command palette, and the "c" / Ctrl+Shift+Space shortcut.
 */
export type CaptureDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function CaptureDialog({ open }: CaptureDialogProps) {
  if (!open) return null;
  return null;
}
