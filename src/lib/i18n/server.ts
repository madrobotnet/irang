import { headers } from "next/headers";
import { localeFromHeaders, type Locale } from "./locale";

export { localeFromHeaders, type Locale } from "./locale";

/**
 * Locale for the current request in Server Components, generateMetadata and Server Functions.
 * Reads this request's Cookie and Accept-Language headers every call; there is no module-level
 * cache, so concurrent requests never share a locale. Importing this file from a Client
 * Component fails the build (next/headers is server-only).
 */
export async function getRequestLocale(): Promise<Locale> {
  return localeFromHeaders(await headers());
}

/**
 * Locale inside a Route Handler, including handlers wrapped by withApi()/withPublicApi():
 *   export const POST = withApi(async (request) => { const locale = localeFromRequest(request); ... });
 */
export function localeFromRequest(request: Request): Locale {
  return localeFromHeaders(request.headers);
}
