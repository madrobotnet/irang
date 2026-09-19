"use client";

import { CaptureProvider } from "@/components/capture/CaptureContext";
import { ToastProvider } from "@/components/ui/Toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CaptureProvider>{children}</CaptureProvider>
    </ToastProvider>
  );
}
