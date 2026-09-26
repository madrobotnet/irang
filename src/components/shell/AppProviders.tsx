"use client";

import { CaptureProvider } from "@/components/capture/CaptureContext";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";
import { ToastProvider } from "@/components/ui/Toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CaptureProvider>
        <PwaInstallProvider>{children}</PwaInstallProvider>
      </CaptureProvider>
    </ToastProvider>
  );
}
