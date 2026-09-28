import { z } from "zod";

export const ApiFormatSchema = z.enum(["chat-completions", "responses", "anthropic-messages"]);
export type ApiFormat = z.infer<typeof ApiFormatSchema>;
export const ModelSchema = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:@~/-]+$/);
export const ApiKeySchema = z.string().trim().max(4096).regex(/^\S*$/);
export const ConnectionNameSchema = z.string().trim().min(1).max(80);

export const BaseUrlSchema = z.string().trim().min(1).max(2048).transform((value, context) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    context.addIssue({ code: "custom", message: "올바른 API 기본 URL을 입력해 주세요." });
    return z.NEVER;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    context.addIssue({ code: "custom", message: "인증 정보·쿼리·해시가 없는 HTTP(S) 기본 주소를 입력해 주세요." });
    return z.NEVER;
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
});

const reservedHeaders = new Set([
  "host", "content-length", "connection", "transfer-encoding", "cookie", "set-cookie",
  "proxy-authorization", "proxy-authenticate", "upgrade", "te", "trailer", "keep-alive",
]);

export const ExtraHeadersSchema = z.record(
  z.string().min(1).max(80).regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
  z.string().max(4096).regex(/^[^\r\n]*$/),
).superRefine((headers, context) => {
  const names = new Set<string>();
  if (Object.keys(headers).length > 16) {
    context.addIssue({ code: "custom", message: "추가 헤더는 16개까지 입력할 수 있어요." });
  }
  for (const name of Object.keys(headers)) {
    const lower = name.toLowerCase();
    if (reservedHeaders.has(lower) || names.has(lower)) {
      context.addIssue({ code: "custom", path: [name], message: "예약되었거나 중복된 헤더 이름입니다." });
    }
    names.add(lower);
  }
}).transform((headers) => Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])));

export const ApiOptionsShape = {
  baseUrl: BaseUrlSchema.optional(),
  apiFormat: ApiFormatSchema.optional(),
  headers: ExtraHeadersSchema.optional(),
  maxOutputTokens: z.number().int().min(1).max(128_000).optional(),
} as const;
