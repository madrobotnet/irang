"use client";

import { useEffect } from "react";

/** P1 soft stub: reserves ⌘/Ctrl+K without blocking login/shell polish. */
export function CommandPaletteStub() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isK = event.key.toLowerCase() === "k";
      if (!isK || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
