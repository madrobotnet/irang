import type { Metadata } from "next";
import { ConnectCompleteView } from "@/features/setup/ConnectComplete";
import { CONNECT_COPY, type ConnectOutcome } from "@/features/setup/connect-copy";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: CONNECT_COPY[await getRequestLocale()].metaTitle, robots: { index: false, follow: false } };
}

export default async function ConnectCompletePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly status?: string; readonly stage?: string }>;
}) {
  const params = await searchParams;
  const outcome: ConnectOutcome = params.status === "success" ? "success" : params.status === "pending" ? "pending" : "failure";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas bg-grain px-4 py-8 sm:px-6">
      <ConnectCompleteView outcome={outcome} setup={params.stage === "setup"} />
    </main>
  );
}
