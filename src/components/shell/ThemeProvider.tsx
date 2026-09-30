"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { nextTheme, readStoredTheme, resolveTheme, THEME_CHANGE_EVENT, writeStoredTheme, type ResolvedTheme, type Theme } from "./theme";

export type { ResolvedTheme, Theme } from "./theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

const readPrefersDark = () => window.matchMedia(DARK_QUERY).matches;

export type ThemeContextValue = {
  /** Stored preference. */
  theme: Theme;
  /** What is actually applied right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Cycle light → dark → system. */
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Server render and hydration both see "system"/light (the server snapshot);
 * the inline THEME_INIT_SCRIPT has already put the right class on <html>, so
 * the first paint is correct and the store swap after hydration is invisible.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => "system" as Theme);
  const prefersDark = useSyncExternalStore(subscribeTheme, readPrefersDark, () => false);
  const resolvedTheme = resolveTheme(theme, prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => writeStoredTheme(next), []);
  const cycleTheme = useCallback(() => writeStoredTheme(nextTheme(theme)), [theme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme, cycleTheme }), [theme, resolvedTheme, setTheme, cycleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
