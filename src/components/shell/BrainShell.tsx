"use client";

import { usePathname } from "next/navigation";
import { DeskDock } from "./DeskDock";
import { DeskRail } from "./DeskRail";
import styles from "./BrainShell.module.css";

export function BrainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const graphPage = pathname === "/graph" || pathname.startsWith("/graph/");

  return (
    <div className={styles.root} data-graph={graphPage ? "on" : "off"} data-desk-shell="a">
      <DeskRail />
      <div className={styles.body}>
        <div className={styles.stage}>
          <main className={styles.main}>{children}</main>
        </div>
        <DeskDock />
      </div>
    </div>
  );
}
