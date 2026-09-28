import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function Section({ id, title, description, children, className }: { id: string; title: string; description: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("grid gap-4 py-7 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-10", className)}>
      <div>
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm text-mute">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
