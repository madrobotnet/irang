import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole, NotebookPen, Server } from "lucide-react";
import { Mark } from "@/components/shell/Sidebar";
import { SetupForm } from "@/features/setup/SetupForm";
import { setupState } from "@/server/setup/service";

export const metadata: Metadata = { title: "처음 시작하기", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const state = databaseConfigured ? await setupState() : "disabled";
  if (state === "complete") redirect("/login");

  return (
    <main className="min-h-dvh bg-canvas bg-grain px-4 py-8 sm:px-6 lg:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-12">
        <header className="lg:pt-6">
          <div className="mb-8 flex items-center gap-2.5">
            <Mark className="size-7" />
            <span className="text-md font-semibold tracking-tight">세컨드 브레인</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">내 노트 공간 만들기</h1>
          <p className="mt-3 text-md leading-relaxed text-mute">
            로그인 비밀번호를 정하면 준비가 끝납니다. AI 연결은 선택이며, 나중에 설정 화면에서도 바꿀 수 있어요.
          </p>
          <ul className="mt-8 space-y-5 text-sm text-mute">
            <li className="flex gap-3">
              <LockKeyhole aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
              <span>설치 확인 코드로 최초 설정을 보호해요.</span>
            </li>
            <li className="flex gap-3">
              <NotebookPen aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
              <span>AI 없이도 노트, 캡처, 검색과 그래프를 사용할 수 있어요.</span>
            </li>
            <li className="flex gap-3">
              <Server aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
              <span>데이터와 연결 설정은 이 서버에 저장됩니다. 공개 서비스는 HTTPS로 열어 주세요.</span>
            </li>
          </ul>
        </header>
        <section aria-labelledby="setup-form-heading" className="surface-card p-5 sm:p-8">
          <h2 id="setup-form-heading" className="mb-6 text-xl font-semibold">최초 설정</h2>
          {state === "ready" ? <SetupForm /> : (
            <div className="space-y-4 text-sm leading-relaxed">
              <p role="status" className="font-medium">서버 준비가 먼저 필요합니다.</p>
              {!databaseConfigured && <p>Docker 또는 서버 환경에서 PostgreSQL 연결 주소인 <code>DATABASE_URL</code>을 설정해 주세요.</p>}
              <p>
                설치자가 저장소 README의 Docker 명령으로 설치 확인 코드를 만들고,
                환경 변수 <code>SETUP_TOKEN</code>에 지정한 뒤 앱을 다시 시작해 주세요.
              </p>
              <p className="text-mute">이 코드는 로그인 비밀번호와 다릅니다. 공유 링크나 주소에 넣지 말고 설치자만 보관하세요.</p>
              <a href="/setup" className="inline-flex min-h-touch items-center text-accent underline focus-ring">준비 상태 다시 확인</a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
