"use client";

import { ExternalLink, LogIn, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api-client";
import type { AuthAttemptView } from "@/lib/ai-auth-flow";
import type { WebAuthProvider } from "@/lib/ai-auth";

type AuthScope = {
  readonly setupToken?: string;
};

export async function abandonAuthAttempt(id: string, scope: AuthScope): Promise<void> {
  await api<{ ok: true }>(`/api/ai/auth/${id}`, {
    method: "DELETE",
    json: scope.setupToken ? { setupToken: scope.setupToken.trim() } : {},
  });
}

function attemptError(status: AuthAttemptView["status"]): string | null {
  switch (status) {
    case "denied":
      return "로그인이 거부됐어요. 다시 시작해 주세요.";
    case "expired":
      return "로그인 시간이 만료됐어요. 다시 시작해 주세요.";
    case "failed":
      return "로그인을 완료하지 못했어요. 다시 시도해 주세요.";
    case "starting":
    case "pending":
    case "ready":
      return null;
  }
}

export function AiAuthPanel({
  provider,
  enterpriseDomain,
  setupToken,
  disabled,
  readyAttemptId,
  hasSavedCredential = false,
  onReadyAction,
}: {
  readonly provider: WebAuthProvider;
  readonly enterpriseDomain?: string;
  readonly setupToken?: string;
  readonly disabled?: boolean;
  readonly readyAttemptId?: string;
  readonly hasSavedCredential?: boolean;
  readonly onReadyAction: (attemptId?: string) => void;
}) {
  const [attempt, setAttempt] = useState<AuthAttemptView | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestAttempt = useRef<AuthAttemptView | null>(null);
  const scopeGeneration = useRef(0);
  const onAuthenticated = useEffectEvent((id: string) => onReadyAction(id));

  useEffect(() => {
    latestAttempt.current = attempt;
  }, [attempt]);

  useEffect(() => () => {
    scopeGeneration.current += 1;
    const current = latestAttempt.current;
    if (current && (current.status === "starting" || current.status === "pending")) {
      void abandonAuthAttempt(current.id, setupToken ? { setupToken: setupToken.trim() } : {})
        .catch(() => console.warn("Provider login cleanup failed; the attempt will expire."));
    }
  }, [provider, enterpriseDomain, setupToken]);

  useEffect(() => {
    if (!attempt || (attempt.status !== "starting" && attempt.status !== "pending")) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => {
      void api<AuthAttemptView>(`/api/ai/auth/${attempt.id}`, {
        method: "POST",
        json: setupToken ? { setupToken: setupToken.trim() } : {},
        signal: controller.signal,
      }).then((next) => {
        if (!active) return;
        latestAttempt.current = next;
        setAttempt(next);
        const statusError = attemptError(next.status);
        setError(statusError);
        if (next.status === "ready") onAuthenticated(next.id);
      }).catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "로그인 상태를 확인하지 못했어요.");
      });
    }, attempt.retryAfterMs ?? 5_000);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt, setupToken]);

  const start = async () => {
    if (setupToken !== undefined && setupToken.trim().length < 32) {
      setError("먼저 32자 이상의 설치 확인 코드를 입력해 주세요.");
      return;
    }
    setStarting(true);
    setError(null);
    onReadyAction(undefined);
    const generation = scopeGeneration.current;
    const previous = latestAttempt.current;
    latestAttempt.current = null;
    setAttempt(null);
    try {
      if (previous) await abandonAuthAttempt(previous.id, setupToken ? { setupToken: setupToken.trim() } : {});
      if (generation !== scopeGeneration.current) return;
      const next = await api<AuthAttemptView>("/api/ai/auth", {
        method: "POST",
        json: {
          provider,
          ...(enterpriseDomain?.trim() ? { enterpriseDomain: enterpriseDomain.trim() } : {}),
          ...(setupToken ? { setupToken: setupToken.trim() } : {}),
        },
      });
      if (generation !== scopeGeneration.current) {
        await abandonAuthAttempt(next.id, setupToken ? { setupToken: setupToken.trim() } : {});
        return;
      }
      latestAttempt.current = next;
      setAttempt(next);
      const statusError = attemptError(next.status);
      setError(statusError);
    } catch (cause) {
      if (generation !== scopeGeneration.current) return;
      if (previous) {
        const failed = { ...previous, status: "failed" } as const;
        latestAttempt.current = failed;
        setAttempt(failed);
      }
      setError(cause instanceof Error ? cause.message : "로그인을 시작하지 못했어요.");
    } finally {
      if (generation === scopeGeneration.current) setStarting(false);
    }
  };

  const cancel = async () => {
    if (!attempt) return;
    const id = attempt.id;
    scopeGeneration.current += 1;
    latestAttempt.current = null;
    setAttempt(null);
    onReadyAction(undefined);
    setError(null);
    try {
      await abandonAuthAttempt(id, setupToken ? { setupToken: setupToken.trim() } : {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그인 시도를 취소하지 못했어요.");
    }
  };

  return (
    <div className="rounded-ctl border border-line bg-desk px-3 py-3 text-sm">
      <p className="text-pretty">
        제공자 페이지에서 로그인하고, 확인 코드가 표시되면 그 페이지에 입력하세요. 비밀번호와 발급된 토큰은 앱 입력창에 넣지 않아요.
      </p>
      {provider === "openrouter" ? (
        <p className="mt-2 text-mute">OpenRouter Auth는 API 키를 발급하는 방식이며 OpenRouter 사용 요금이 적용돼요. 다른 서비스의 구독 이용권을 가져오지 않아요.</p>
      ) : null}
      {attempt?.verificationUrl ? (
        <a
          href={attempt.verificationUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-touch items-center gap-2 text-accent underline focus-ring"
        >
          로그인 페이지 열기
          <ExternalLink aria-hidden className="size-4" />
        </a>
      ) : null}
      {attempt?.userCode ? (
        <p className="mt-2">
          확인 코드: <code className="rounded-ctl bg-card px-2 py-1 font-mono text-xs">{attempt.userCode}</code>
        </p>
      ) : null}
      {attempt?.status === "ready" || readyAttemptId ? (
        <p role="status" className="mt-2 text-ok">로그인을 확인했어요. 이제 연결을 저장하세요.</p>
      ) : hasSavedCredential ? (
        <p className="mt-2 text-mute">저장된 로그인이 있어요. 제공자와 기업 도메인을 바꾸지 않으면 그대로 유지돼요.</p>
      ) : attempt && (attempt.status === "starting" || attempt.status === "pending") ? (
        <p role="status" className="mt-2 text-mute">로그인 완료를 기다리는 중이에요.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="lg"
          loading={starting}
          disabled={disabled || Boolean(attempt && (attempt.status === "starting" || attempt.status === "pending"))}
          leading={<LogIn aria-hidden className="size-4" />}
          onClick={() => void start()}
        >
          {readyAttemptId ? "다시 로그인" : "로그인 시작"}
        </Button>
        {attempt ? (
          <Button size="lg" disabled={disabled} leading={<X aria-hidden className="size-4" />} onClick={() => void cancel()}>
            로그인 취소
          </Button>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-danger">{error}</p> : null}
    </div>
  );
}
