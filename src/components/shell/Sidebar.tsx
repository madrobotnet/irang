"use client";

import { LogOut, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { Kbd } from "@/components/ui/Kbd";
import { isNavActive, NAV_ITEMS, type NavItem } from "./nav";
import { useShell } from "./ShellProvider";
import { modKey } from "./shortcuts";

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const THEME_LABEL = { light: "밝은 테마", dark: "어두운 테마", system: "시스템 테마" } as const;

/** Desktop rail (>= lg). 64px icons; expands to 220px with labels, persisted via data-rail on <html>. */
export function Sidebar() {
  const pathname = usePathname();
  const shell = useShell();
  const expanded = shell.railExpanded;
  const ThemeIcon = THEME_ICON[shell.theme];

  return (
    <nav
      aria-label="주 메뉴"
      data-expanded={expanded || undefined}
      className={cn(
        "hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-rail-line bg-rail text-rail-ink",
        "w-rail transition-[width] duration-200 ease-out-soft data-expanded:w-rail-open",
      )}
    >
      <div className="flex h-topbar items-center px-3">
        <Link
          href="/"
          className={cn("flex h-9 items-center gap-2.5 rounded-ctl px-1.5 text-rail-ink focus-ring", expanded ? "min-w-0 flex-1" : "justify-center")}
        >
          <Mark />
          {expanded ? <span className="truncate text-md font-semibold tracking-tight">세컨드 브레인</span> : null}
        </Link>
      </div>

      <div className="px-2.5 pb-1">
        <button
          type="button"
          onClick={() => shell.openCapture()}
          title={expanded ? undefined : "빠르게 캡처 (c)"}
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-ctl bg-accent text-accent-ink transition-[filter] hover:brightness-95 focus-ring",
            expanded ? "px-3" : "justify-center",
          )}
        >
          <Plus aria-hidden className="size-5" />
          {expanded ? (
            <>
              <span className="flex-1 text-left text-base font-medium">빠르게 캡처</span>
              <Kbd className="border-transparent bg-accent-ink/20 text-accent-ink">c</Kbd>
            </>
          ) : (
            <span className="sr-only">빠르게 캡처</span>
          )}
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pt-1 scrollbar-thin">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <RailLink item={item} active={isNavActive(pathname, item.href)} expanded={expanded} badge={item.id === "inbox" ? shell.inboxCount : null} />
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-0.5 border-t border-rail-line px-2.5 py-2">
        <RailButton
          expanded={expanded}
          label="명령 팔레트"
          hint={[modKey(), "K"]}
          icon={<Search aria-hidden className="size-5" />}
          onClick={() => shell.openPalette("all")}
        />
        <RailButton expanded={expanded} label={THEME_LABEL[shell.theme]} icon={<ThemeIcon aria-hidden className="size-5" />} onClick={shell.cycleTheme} />
        <RailButton expanded={expanded} label="로그아웃" icon={<LogOut aria-hidden className="size-5" />} onClick={() => void shell.logout()} />
        <RailButton
          expanded={expanded}
          label={expanded ? "메뉴 접기" : "메뉴 펼치기"}
          icon={expanded ? <PanelLeftClose aria-hidden className="size-5" /> : <PanelLeftOpen aria-hidden className="size-5" />}
          onClick={() => shell.setRailExpanded(!expanded)}
          aria-expanded={expanded}
        />
      </div>
    </nav>
  );
}

function RailLink({ item, active, expanded, badge }: { item: NavItem; active: boolean; expanded: boolean; badge: number | null }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={expanded ? undefined : item.label}
      className={cn(
        "relative flex h-10 items-center gap-2.5 rounded-ctl text-rail-mute transition-colors hover:bg-rail-hover hover:text-rail-ink focus-ring",
        expanded ? "px-3" : "justify-center",
        active && "bg-rail-hover text-rail-ink",
      )}
    >
      {active ? <span aria-hidden className="absolute inset-y-2 -left-2.5 w-0.5 rounded-r bg-accent" /> : null}
      <Icon aria-hidden className="size-5 shrink-0" />
      {expanded ? <span className="flex-1 truncate text-base">{item.label}</span> : <span className="sr-only">{item.label}</span>}
      {badge ? (
        <Badge tone="rail" count={badge} className={cn(!expanded && "absolute right-1.5 top-1.5")} aria-label={`${badge}개 대기 중`} />
      ) : null}
    </Link>
  );
}

function RailButton({
  expanded,
  label,
  hint,
  icon,
  onClick,
  ...rest
}: {
  expanded: boolean;
  label: string;
  hint?: readonly string[];
  icon: React.ReactNode;
  onClick: () => void;
  "aria-expanded"?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={expanded ? undefined : label}
      className={cn(
        "flex h-10 w-full items-center gap-2.5 rounded-ctl text-rail-mute transition-colors hover:bg-rail-hover hover:text-rail-ink focus-ring",
        expanded ? "px-3" : "justify-center",
      )}
      {...rest}
    >
      {icon}
      {expanded ? <span className="flex-1 truncate text-left text-base">{label}</span> : <span className="sr-only">{label}</span>}
      {expanded && hint ? (
        <span aria-hidden className="inline-flex gap-0.5">
          {hint.map((k) => (
            <Kbd key={k} className="border-rail-line bg-rail-hover text-rail-mute shadow-none">
              {k}
            </Kbd>
          ))}
        </span>
      ) : null}
    </button>
  );
}

/** Wordmark: two linked squares on the terracotta accent. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-6 shrink-0", className)} fill="none">
      <rect x="3" y="3" width="10" height="10" rx="2.5" className="fill-accent" />
      <rect x="11" y="11" width="10" height="10" rx="2.5" className="fill-accent" opacity="0.55" />
    </svg>
  );
}
