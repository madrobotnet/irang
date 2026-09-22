import { AppShell } from "@/components/shell/AppShell";
import { AppProviders } from "@/components/shell/AppProviders";
import { CaptureFab } from "@/components/capture/CaptureFab";

export default function AuthenticatedShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <AppShell>
        {children}
        <CaptureFab />
      </AppShell>
    </AppProviders>
  );
}
