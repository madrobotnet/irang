import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/home/HomeScreen";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import { getAuthRuntime } from "@/server/auth/runtime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
  const { service } = await getAuthRuntime();
  const session = await service.lookup(token);
  if (!session) {
    redirect("/login");
  }

  return <HomeScreen />;
}
