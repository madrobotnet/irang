import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/** Keyboard key cap. Callers supply the platform modifier text when needed. */
export function Kbd({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong/80 bg-desk px-1 text-2xs font-medium text-mute",
        "shadow-[inset_0_-1px_0_var(--line-strong)]",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}

/** "⌘K"-style hint: a row of Kbd caps. */
export function Shortcut({ keys, className }: { keys: readonly string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {keys.map((key, index) => (
        <Kbd key={`${key}-${index}`}>{key}</Kbd>
      ))}
    </span>
  );
}
