import { AppShell } from "@/components/shell/AppShell";

export default function AuthenticatedShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
