import type { Metadata } from "next";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import { Mark } from "@/components/shell/Sidebar";

export const metadata: Metadata = {
  title: "AI 연결 확인",
  robots: { index: false, follow: false },
};

export default async function ConnectCompletePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly status?: string; readonly stage?: string }>;
}) {
  const params = await searchParams;
  const succeeded = params.status === "success";
  const pending = params.status === "pending";
  const setup = params.stage === "setup";
  const Icon = pending ? Clock : succeeded ? CircleCheck : CircleX;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas bg-grain px-4 py-8 sm:px-6">
      <section className="surface-card w-full max-w-lg p-5 sm:p-8" aria-labelledby="connect-complete-title">
        <div className="mb-6 flex items-center gap-2.5">
          <Mark className="size-7" />
          <span className="text-md font-semibold tracking-tight">세컨드 브레인</span>
        </div>
        <Icon aria-hidden className={pending ? "size-8 text-warn" : succeeded ? "size-8 text-ok" : "size-8 text-danger"} />
        <h1 id="connect-complete-title" className="mt-3 text-2xl font-semibold tracking-tight">
          {pending ? "로그인 확인 중" : succeeded ? "로그인을 확인했어요" : "로그인을 완료하지 못했어요"}
        </h1>
        <p className="mt-3 text-md leading-relaxed text-mute">
          {pending
            ? `제공자 응답이 지연되고 있어요. 원래 ${setup ? "최초 설정" : "설정"} 탭으로 돌아가면 자동으로 다시 확인해요.`
            : succeeded
            ? `원래 ${setup ? "최초 설정" : "설정"} 탭으로 돌아가 연결을 저장하세요. 이 창에는 코드나 자격 증명이 표시되지 않아요.`
            : `원래 ${setup ? "최초 설정" : "설정"} 탭으로 돌아가 로그인 상태를 확인한 뒤 다시 시도하세요.`}
        </p>
        <p className="mt-5 text-sm text-mute">이 창은 닫아도 됩니다.</p>
      </section>
    </main>
  );
}
