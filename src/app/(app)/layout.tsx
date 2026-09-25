import { AppShell } from "@/components/shell/AppShell";
import { AppProviders } from "@/components/shell/AppProviders";
import { CaptureFab } from "@/components/capture/CaptureFab";
import { OfflineBanner } from "@/components/home/OfflineBanner";

export default function AuthenticatedShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <AppShell>
        <OfflineBanner />
        {children}
        <CaptureFab />
      </AppShell>
    </AppProviders>
  );
}
