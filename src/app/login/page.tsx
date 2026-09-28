import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { LOGIN_COPY } from "@/features/auth/login-copy";
import { sanitizeNextUrl } from "@/features/auth/next-url";
import { Mark } from "@/components/shell/Sidebar";
import { getSession } from "@/server/auth/session";
import { setupState } from "@/server/setup/service";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = sanitizeNextUrl(params.next);
  if (!process.env.DATABASE_URL?.trim()) redirect("/setup");
  if (await getSession()) redirect(next);
  if (await setupState() !== "complete") redirect("/setup");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas bg-grain px-4 py-10">
      <section aria-labelledby="login-heading" className="w-full max-w-sm surface-card p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <Mark className="size-7" />
          <span className="text-md font-semibold tracking-tight">{LOGIN_COPY.title}</span>
        </div>
        <h1 id="login-heading" className="text-xl font-semibold tracking-tight">
          {LOGIN_COPY.heading}
        </h1>
        <p className="mb-5 mt-1 text-sm text-mute">{LOGIN_COPY.lead}</p>
        <LoginForm next={next} />
        <p className="mt-6 border-t border-line pt-4 text-xs text-mute">{LOGIN_COPY.footnote}</p>
      </section>
    </main>
  );
}
