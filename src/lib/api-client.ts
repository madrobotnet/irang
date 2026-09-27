import type { ApiErrorBody } from "./types";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** JSON fetch for client components. Redirects to /login on 401. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const response = await fetch(path, {
    ...rest,
    headers: json === undefined ? headers : { "content-type": "application/json", ...headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
    credentials: "same-origin",
  });
  if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError(
      response.status,
      body?.error.code ?? "http_error",
      body?.error.message ?? `Request failed (${response.status})`,
      body ?? undefined,
    );
  }
  return (await response.json()) as T;
}

/** SWR fetcher. */
export const fetcher = <T>(path: string) => api<T>(path);
