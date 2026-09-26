import { BrainShell } from "@/components/shell/BrainShell";
import { AppProviders } from "@/components/shell/AppProviders";
import { OfflineBanner } from "@/components/home/OfflineBanner";

export default function AuthenticatedShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <BrainShell>
        <OfflineBanner />
        {children}
      </BrainShell>
    </AppProviders>
  );
}
