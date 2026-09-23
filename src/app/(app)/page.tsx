import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HomeTop3 } from "@/components/home/HomeTop3";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import { getAuthRuntime } from "@/server/auth/runtime";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
  const { service } = await getAuthRuntime();
  const session = await service.lookup(token);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>오늘</h1>
        <div className={styles.actions}>
          <span className={styles.kbdHint} title="명령 팔레트 (준비 중)">⌘K</span>
        </div>
      </header>
      <p className={styles.lead}>Second Brain · brain.madrobot.net</p>
      <HomeTop3 />
      <form method="post" action="/api/auth/logout" className={styles.logout}>
        <button type="submit" className={styles.logoutBtn}>나가기</button>
      </form>
    </div>
  );
}
