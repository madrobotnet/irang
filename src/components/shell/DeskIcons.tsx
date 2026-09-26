type IconProps = { className?: string };

export function IconHome({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconInbox({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14v13H5z" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

export function IconChat({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 4z" />
    </svg>
  );
}

export function IconGraph({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="7" cy="8" r="2.2" />
      <circle cx="17" cy="7" r="2.2" />
      <circle cx="12" cy="16" r="2.2" />
      <path d="M8.8 9.5 15 8.2M8.5 9.8l2.8 5M15.2 8.6l-2.4 5.4" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.9 6.3l1.6 1.6M17.5 16.1l1.6 1.6M3 12h2.2M18.8 12H21M4.9 17.7l1.6-1.6M17.5 7.9l1.6-1.6" />
    </svg>
  );
}

export function deskIconFor(id: string, className?: string) {
  switch (id) {
    case "home":
      return <IconHome className={className} />;
    case "search":
      return <IconSearch className={className} />;
    case "inbox":
      return <IconInbox className={className} />;
    case "chat":
      return <IconChat className={className} />;
    case "graph":
      return <IconGraph className={className} />;
    default:
      return <IconHome className={className} />;
  }
}
