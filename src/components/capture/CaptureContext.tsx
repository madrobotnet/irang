"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { CaptureTarget } from "@/lib/notes/client-api";
import { CaptureSheet } from "./CaptureSheet";

type CaptureContextValue = {
  openCapture: (defaultTarget?: CaptureTarget) => void;
  closeCapture: () => void;
};

const CaptureContext = createContext<CaptureContextValue | null>(null);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultMode, setDefaultMode] = useState<CaptureTarget>("inbox");

  const openCapture = useCallback((mode: CaptureTarget = "inbox") => {
    setDefaultMode(mode);
    setOpen(true);
  }, []);

  const closeCapture = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ openCapture, closeCapture }),
    [openCapture, closeCapture],
  );

  return (
    <CaptureContext.Provider value={value}>
      {children}
      <CaptureSheet open={open} defaultMode={defaultMode} onClose={closeCapture} />
    </CaptureContext.Provider>
  );
}

export function useCapture(): CaptureContextValue {
  const ctx = useContext(CaptureContext);
  if (!ctx) {
    throw new Error("useCapture must be used within CaptureProvider");
  }
  return ctx;
}
