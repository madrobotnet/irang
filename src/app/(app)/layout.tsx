import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getSession } from "@/server/auth/session";

/**
 * Server gate for every app page: a DB-verified session or a redirect to /login.
 * (src/proxy.ts already carries `?next=` for cookieless requests; a stale cookie lands on plain /login.)
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AppShell>{children}</AppShell>;
}
