"use client";

import { LockKeyhole, NotebookPen, Server } from "lucide-react";
import { LanguageSwitch, useCopy, useLocale } from "@/components/i18n";
import { DocumentTitle } from "@/components/i18n/DocumentTitle";
import { BrandMark } from "@/components/ui/BrandMark";
import { brandName } from "@/lib/brand";
import { SetupForm } from "./SetupForm";
import { SETUP_COPY } from "./setup-copy";

/**
 * First-run setup screen. Client-rendered so the intro, headings, help and title follow a
 * language switch in place; the form below keeps every typed value and any pending sign-in.
 */
export function SetupScreen({ ready, databaseConfigured }: { readonly ready: boolean; readonly databaseConfigured: boolean }) {
  const { locale } = useLocale();
  const copy = useCopy(SETUP_COPY);
  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-12">
      <DocumentTitle title={copy.metaTitle} />
      <header className="lg:pt-6">
        <div className="mb-8 flex items-center gap-2.5">
          <BrandMark className="size-7" />
          <span className="text-md font-semibold tracking-tight">{brandName(locale)}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{copy.heading}</h1>
        <p className="mt-3 text-md leading-relaxed text-mute">
          {copy.lead}
        </p>
        <ul className="mt-8 space-y-5 text-sm text-mute">
          <li className="flex gap-3">
            <LockKeyhole aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
            <span>{copy.points.token}</span>
          </li>
          <li className="flex gap-3">
            <NotebookPen aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
            <span>{copy.points.offline}</span>
          </li>
          <li className="flex gap-3">
            <Server aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
            <span>{copy.points.server}</span>
          </li>
        </ul>
        <LanguageSwitch className="mt-8 border-t border-line pt-5 lg:max-w-xs" />
      </header>
      <section aria-labelledby="setup-form-heading" className="surface-card p-5 sm:p-8">
        <h2 id="setup-form-heading" className="mb-6 text-xl font-semibold">{copy.formHeading}</h2>
        {ready ? <SetupForm /> : (
          <div className="space-y-4 text-sm leading-relaxed">
            <p role="status" className="font-medium">{copy.notReady.status}</p>
            {!databaseConfigured && (
              <p>{copy.notReady.database.before}<code>DATABASE_URL</code>{copy.notReady.database.after}</p>
            )}
            <p>
              {copy.notReady.token.before}<code>SETUP_TOKEN</code>{copy.notReady.token.after}
            </p>
            <p className="text-mute">{copy.notReady.note}</p>
            <a href="/setup" className="inline-flex min-h-touch items-center text-accent underline focus-ring">{copy.notReady.recheck}</a>
          </div>
        )}
      </section>
    </div>
  );
}
