import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/home/HomeScreen";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import { AuthStorageInitError } from "@/server/auth/init-errors";
import { getAuthRuntime } from "@/server/auth/runtime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
  let service;
  try {
    ({ service } = await getAuthRuntime());
  } catch (error) {
    if (error instanceof AuthStorageInitError) {
      redirect("/login?error=config");
    }
    throw error;
  }
  let session;
  try {
    session = await service.lookup(token);
  } catch {
    redirect("/login?error=config");
  }
  if (!session) {
    redirect("/login");
  }

  return <HomeScreen />;
}
