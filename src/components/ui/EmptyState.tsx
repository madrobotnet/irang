import type { ComponentType, ReactNode } from "react";
import { cn } from "./cn";

export type EmptyStateProps = {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: ReactNode;
  /** One sentence that says what to do next. */
  description?: ReactNode;
  action?: ReactNode;
  /** `panel` draws a dashed frame; `plain` sits inline in a list. */
  variant?: "panel" | "plain";
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, variant = "panel", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 text-left",
        variant === "panel" && "rounded-card border border-dashed border-line-strong/80 bg-desk/60 px-5 py-6",
        variant === "plain" && "px-1 py-4",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden className="size-5 text-mute" /> : null}
      <div className="max-w-prose">
        <p className="text-md font-medium text-ink">{title}</p>
        {description ? <p className="mt-0.5 text-sm text-mute">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
