"use client";

import { CircleAlert, Compass } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { DocumentTitle } from "@/components/i18n/DocumentTitle";
import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button, buttonClassName } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { brandName } from "@/lib/brand";
import { BOUNDARY_COPY } from "./copy";

export type StatusScreenProps = { kind: "notFound" } | { kind: "error"; onRetry: () => void; digest?: string };

/**
 * Full-page status card for the root not-found, error and global-error boundaries, in the
 * sign-in card style. Never shows the raw error message; a server digest is shown for support.
 */
export function StatusScreen(props: StatusScreenProps) {
  const { locale } = useLocale();
  const copy = useCopy(BOUNDARY_COPY);
  const headingId = useId();
  const screen = props.kind === "error" ? copy.error : copy.notFound;
  const Icon = props.kind === "error" ? CircleAlert : Compass;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas bg-grain px-4 py-10">
      <DocumentTitle title={screen.documentTitle} />
      <section aria-labelledby={headingId} className="w-full max-w-sm surface-card p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark className="size-6" />
          <span className="text-md font-semibold tracking-tight">{brandName(locale)}</span>
        </div>
        <Icon aria-hidden className={cn("mb-3 size-6", props.kind === "error" ? "text-danger" : "text-mute")} />
        <h1 id={headingId} className="text-xl font-semibold tracking-tight">
          {screen.title}
        </h1>
        <p className="mt-1 text-sm text-mute">{screen.body}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {props.kind === "error" ? (
            <Button variant="primary" size="lg" onClick={props.onRetry}>
              {copy.error.retry}
            </Button>
          ) : null}
          <Link href="/" className={buttonClassName({ variant: props.kind === "error" ? "secondary" : "primary", size: "lg" })}>
            {copy.home}
          </Link>
        </div>
        {props.kind === "error" && props.digest ? (
          <p className="mt-6 border-t border-line pt-4 text-xs text-mute">{copy.error.reference(props.digest)}</p>
        ) : null}
      </section>
    </main>
  );
}
