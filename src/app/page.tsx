import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession, SESSION_COOKIE } from "@/lib/auth/session";
import styles from "./home.module.css";

export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await resolveSession(token) : null;
  if (session === null) redirect("/login");

  return (
    <main className={styles["home"]} data-app-shell="brain">
      <h1 className={styles["title"]}>세컨드 브레인</h1>
      <p className={styles["lede"]}>오늘 들어갈 곳</p>
      <nav className={styles["actions"]} aria-label="주요 기능">
        <a className={styles["action"]} href="/search"><strong>검색</strong><span>노트에서 찾기</span></a>
        <a className={styles["action"]} href="/inbox"><strong>받은 편지함</strong><span>새로 들어온 것</span></a>
        <a className={styles["action"]} href="/chat"><strong>AI 채팅</strong><span>출처와 함께 묻기</span></a>
      </nav>
      <form action="/api/auth/logout" method="post">
        <button className={styles["logout"]} type="submit">로그아웃</button>
      </form>
    </main>
  );
}
