"use client";

import { LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { useShell } from "@/components/shell/ShellProvider";
import { Badge, Button, Dialog, Skeleton } from "@/components/ui";
import { api } from "@/lib/api-client";
import { Section } from "./SettingsSection";
import { daysUntil, formatExpiry, type RevokeAllResult, type SessionInfo } from "./settings-model";

type Stamped<T> = { value: T; fetchedAt: number };
const fetchSession = async (path: string): Promise<Stamped<SessionInfo>> => ({ value: await api<SessionInfo>(path), fetchedAt: Date.now() });
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

export function SessionSection() {
  const { logout } = useShell();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<Stamped<SessionInfo>>("/api/auth/me", fetchSession, { revalidateOnFocus: true });
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const expiresAt = data?.value.expiresAt ?? null;
  const days = data ? daysUntil(expiresAt, data.fetchedAt) : null;

  const revokeAll = async () => {
    setRevoking(true);
    setRevokeError(null);
    try {
      await api<RevokeAllResult>("/api/auth/sessions/revoke-all", { method: "POST" });
      // /login sits outside the app shell, so every session-scoped client cache unmounts with it.
      router.push("/login");
      router.refresh();
    } catch (cause) {
      setRevokeError(errorText(cause, "세션을 끊지 못했습니다. 다시 시도해 주세요."));
      setRevoking(false);
    }
  };

  const setConfirm = (open: boolean) => {
    setConfirmOpen(open);
    if (!open) setRevokeError(null);
  };

  return (
    <Section id="settings-session" title="로그인 세션" description="이 기기의 로그인이 언제까지 유지되는지 확인하고, 필요하면 로그인을 끊을 수 있어요.">
      <div className="surface-card px-4 py-4 sm:px-5">
        {isLoading && !data ? (
          <div aria-label="세션 정보를 불러오는 중" className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-64 max-w-full" />
          </div>
        ) : error && !data ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-md font-medium text-danger">세션 정보를 불러오지 못했습니다.</p>
            <p className="text-sm text-mute">{errorText(error, "네트워크 상태를 확인해 주세요.")}</p>
            <Button size="lg" leading={<RefreshCw aria-hidden className="size-4" />} onClick={() => void mutate()}>
              다시 불러오기
            </Button>
          </div>
        ) : (
          <dl>
            <dt className="text-sm text-mute">이 기기의 로그인 만료</dt>
            <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {expiresAt ? (
                <>
                  <time dateTime={expiresAt} className="text-md font-medium">
                    {formatExpiry(expiresAt)}
                  </time>
                  {days !== null ? <Badge tone={days <= 3 ? "warn" : "neutral"}>{days === 0 ? "오늘 만료" : `${days}일 남음`}</Badge> : null}
                </>
              ) : (
                <span className="text-md">만료 시각을 확인할 수 없어요.</span>
              )}
            </dd>
          </dl>
        )}
        <p className="mt-3 text-sm text-mute">만료되면 비밀번호로 다시 로그인하면 돼요. 로그인하면 새 기간이 시작돼요.</p>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
          <Button
            size="lg"
            leading={<LogOut aria-hidden className="size-4" />}
            loading={loggingOut}
            onClick={() => {
              setLoggingOut(true);
              void logout().finally(() => setLoggingOut(false));
            }}
          >
            이 기기에서 로그아웃
          </Button>
          <Button variant="danger" size="lg" leading={<ShieldAlert aria-hidden className="size-4" />} onClick={() => setConfirm(true)}>
            모든 기기에서 로그아웃
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirm}
        size="sm"
        bodyClassName="empty:hidden"
        title="모든 기기에서 로그아웃할까요?"
        description="이 기기를 포함해 로그인된 모든 브라우저와 설치한 앱의 세션이 즉시 끊겨요. 다시 쓰려면 기기마다 비밀번호로 로그인해야 해요."
        footer={
          <>
            <Button size="lg" disabled={revoking} onClick={() => setConfirm(false)}>
              취소
            </Button>
            <Button variant="danger" size="lg" loading={revoking} onClick={() => void revokeAll()}>
              모두 로그아웃
            </Button>
          </>
        }
      >
        {revokeError ? (
          <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
            {revokeError}
          </p>
        ) : null}
      </Dialog>
    </Section>
  );
}
