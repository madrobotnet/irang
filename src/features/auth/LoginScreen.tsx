"use client";

import { LanguageSwitch, useCopy, useLocale } from "@/components/i18n";
import { DocumentTitle } from "@/components/i18n/DocumentTitle";
import { BrandMark } from "@/components/ui/BrandMark";
import { brandName } from "@/lib/brand";
import { LoginForm } from "./LoginForm";
import { LOGIN_COPY } from "./login-copy";

/**
 * Login card. Client-rendered so the heading, help text and document title follow a
 * language switch in place, without touching the typed password or a pending sign-in.
 */
export function LoginScreen({ next }: { readonly next: string }) {
  const { locale } = useLocale();
  const copy = useCopy(LOGIN_COPY);
  return (
    <section aria-labelledby="login-heading" className="w-full max-w-sm surface-card p-6 sm:p-7">
      <DocumentTitle title={copy.metaTitle} />
      <div className="mb-6 flex items-center gap-2.5">
        <BrandMark className="size-7" />
        <span className="text-md font-semibold tracking-tight">{brandName(locale)}</span>
      </div>
      <h1 id="login-heading" className="text-xl font-semibold tracking-tight">
        {copy.heading}
      </h1>
      <p className="mb-5 mt-1 text-sm text-mute">{copy.lead}</p>
      <LoginForm next={next} />
      <div className="mt-6 flex flex-col gap-4 border-t border-line pt-4">
        <LanguageSwitch />
        <p className="text-xs text-mute">{copy.footnote}</p>
      </div>
    </section>
  );
}
