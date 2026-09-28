"use client";

import type { ReactNode } from "react";
import { MobileNav, MobileTopBar } from "./MobileNav";
import { ShellProvider } from "./ShellProvider";
import { Sidebar } from "./Sidebar";

/**
 * Authenticated frame: rail on desktop, top bar + bottom nav on mobile.
 * Pages own their inner padding so full-bleed views (graph, editor) can opt out.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <Sidebar />
      <MobileTopBar />
      <div className="min-h-[calc(100dvh-var(--topbar-h))] pb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom,0px))] lg:min-h-dvh lg:pb-0 lg:pl-rail lg:rail-open:pl-rail-open transition-[padding] duration-200 ease-out-soft">
        <main id="main" className="min-h-[var(--workspace-h)] lg:min-h-dvh">
          {children}
        </main>
      </div>
      <MobileNav />
    </ShellProvider>
  );
}
