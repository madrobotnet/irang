import { localizedIssue } from "@/lib/i18n/validation";
import { providerOptionIssueCopy } from "@/lib/i18n/ai-validation-copy";
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
    context.addIssue({ code: "custom", ...localizedIssue(providerOptionIssueCopy.baseUrlInvalid) });
    return z.NEVER;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    context.addIssue({ code: "custom", ...localizedIssue(providerOptionIssueCopy.baseUrlShape) });
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
    context.addIssue({ code: "custom", ...localizedIssue(providerOptionIssueCopy.headerLimit) });
  }
  for (const name of Object.keys(headers)) {
    const lower = name.toLowerCase();
    if (reservedHeaders.has(lower) || names.has(lower)) {
      context.addIssue({ code: "custom", path: [name], ...localizedIssue(providerOptionIssueCopy.headerReserved) });
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
