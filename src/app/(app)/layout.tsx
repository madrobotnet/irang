import { redirect } from "next/navigation";
import { BrainShell } from "@/components/shell/BrainShell";
import { AppProviders } from "@/components/shell/AppProviders";
import { OfflineBanner } from "@/components/home/OfflineBanner";
import { resolveAppSessionGate } from "@/server/auth/app-session-guard";

export default async function AuthenticatedShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await resolveAppSessionGate();
  if (gate.kind === "missing" || gate.kind === "invalid") {
    redirect("/login");
  }
  if (gate.kind === "misconfigured") {
    redirect("/login?error=config");
  }

  return (
    <AppProviders>
      <BrainShell>
        <OfflineBanner />
        {children}
      </BrainShell>
    </AppProviders>
  );
}
