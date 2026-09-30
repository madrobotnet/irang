"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import useSWR, { SWRConfig } from "swr";
import { api, fetcher } from "@/lib/api-client";
import { CaptureDialog } from "@/features/capture/CaptureDialog";
import { hasUnsavedNoteDrafts } from "@/features/notes/draft-store";
import { useCopy } from "@/components/i18n/LocaleProvider";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { CommandPalette, type PaletteMode } from "./CommandPalette";
import { everyLocale, SHELL_COPY } from "./copy";
import { readRailExpanded, subscribeRail, writeRailExpanded } from "./rail";
import { IDLE_CHORD, isEditableTarget, resolveShortcut, type ChordState } from "./shortcuts";
import { ThemeProvider, useTheme, type ResolvedTheme, type Theme } from "./ThemeProvider";

export { RAIL_INIT_SCRIPT, RAIL_STORAGE_KEY } from "./rail";

export type ShellContextValue = {
  openCapture: () => void;
  closeCapture: () => void;
  captureOpen: boolean;
  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
  paletteOpen: boolean;
  /** Open inbox item count; null until the inbox API has answered. */
  inboxCount: number | null;
  refreshInbox: () => void;
  railExpanded: boolean;
  setRailExpanded: (expanded: boolean) => void;
  logout: () => Promise<void>;
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

function ShellState({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const themeCtx = useTheme();
  const { toast } = useToast();
  const copy = useCopy(SHELL_COPY);

  useEffect(() => {
    const protectDrafts = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedNoteDrafts()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDrafts);
    return () => window.removeEventListener("beforeunload", protectDrafts);
  }, []);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("all");
  const chord = useRef<ChordState>(IDLE_CHORD);

  // Server snapshot is "collapsed"; RAIL_INIT_SCRIPT already applied the persisted width pre-hydration.
  const railExpanded = useSyncExternalStore(subscribeRail, readRailExpanded, () => false);
  const setRailExpanded = useCallback((expanded: boolean) => writeRailExpanded(expanded), []);

  // Route change closes the palette (state adjusted during render, no effect round-trip).
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    setPaletteOpen(false);
  }

  const inbox = useSWR<{ items: unknown[]; count: number }>("/api/inbox", fetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    onError: () => undefined,
  });
  const inboxCount = typeof inbox.data?.count === "number" ? inbox.data.count : null;
  const refreshInbox = useCallback(() => void inbox.mutate(), [inbox]);

  const openCapture = useCallback(() => {
    setPaletteOpen(false);
    setCaptureOpen(true);
  }, []);
  const closeCapture = useCallback(() => setCaptureOpen(false), []);
  const openPalette = useCallback((mode: PaletteMode = "all") => {
    setPaletteMode(mode);
    setPaletteOpen(true);
  }, []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const logout = useCallback(async () => {
    if (hasUnsavedNoteDrafts() && !window.confirm(copy.session.confirmUnsaved)) return;
    try {
      await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      // Stays until closed, so it carries every locale and follows a language switch.
      toast(everyLocale((c) => c.session.logoutFailed), { tone: "danger", durationMs: 0 });
      return;
    }
    router.push("/login");
    router.refresh();
  }, [copy, router, toast]);

  const focusSearch = useCallback(() => {
    const field = document.querySelector<HTMLElement>("[data-search-input]");
    if (field) field.focus();
    else router.push("/search");
  }, [router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      const { action, state } = resolveShortcut(
        {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          editable: isEditableTarget(event.target),
        },
        chord.current,
        event.timeStamp,
      );
      chord.current = state;
      if (!action) return;
      event.preventDefault();
      switch (action.type) {
        case "palette":
          setPaletteMode("all");
          setPaletteOpen((open) => !open);
          break;
        case "switcher":
          setPaletteMode("notes");
          setPaletteOpen(true);
          break;
        case "capture":
          openCapture();
          break;
        case "search":
          focusSearch();
          break;
        case "go":
          router.push(action.href);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusSearch, openCapture, router]);

  const value = useMemo<ShellContextValue>(
    () => ({
      openCapture,
      closeCapture,
      captureOpen,
      openPalette,
      closePalette,
      paletteOpen,
      inboxCount,
      refreshInbox,
      railExpanded,
      setRailExpanded,
      logout,
      theme: themeCtx.theme,
      resolvedTheme: themeCtx.resolvedTheme,
      setTheme: themeCtx.setTheme,
      cycleTheme: themeCtx.cycleTheme,
    }),
    [openCapture, closeCapture, captureOpen, openPalette, closePalette, paletteOpen, inboxCount, refreshInbox, railExpanded, setRailExpanded, logout, themeCtx],
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      <CommandPalette open={paletteOpen} mode={paletteMode} onOpenChange={setPaletteOpen} onModeChange={setPaletteMode} onCapture={openCapture} />
    </ShellContext.Provider>
  );
}

/** Wraps the authenticated app: theme, SWR defaults, toasts, capture + palette layers, global shortcuts. */
export function ShellProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SWRConfig value={{ fetcher }}>
        <ToastProvider>
          <ShellState>{children}</ShellState>
        </ToastProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}
