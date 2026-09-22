import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession, SESSION_COOKIE } from "@/lib/auth/session";

export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await resolveSession(token) : null;
  if (session === null) redirect("/login");

  return (
    <main data-app-shell="brain">
      <h1>보호된 홈</h1>
      <p><a href="/notes">노트</a> · <a href="/inbox">받은 편지함</a></p>
      <form action="/api/auth/logout" method="post">
        <button type="submit">로그아웃</button>
      </form>
    </main>
  );
}
