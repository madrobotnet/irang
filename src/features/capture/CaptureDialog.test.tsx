import { expect, test } from "bun:test";
import { ToastProvider } from "@/components/ui/Toast";
import { renderInLocale } from "@/features/setup/test-locale";
import { LOCALES } from "@/lib/i18n/locale";
import { CaptureDialog } from "./CaptureDialog";

test.each([...LOCALES])("capture uses its own URL validation in %s rather than the browser's language", (locale) => {
  const markup = renderInLocale(
    <ToastProvider><CaptureDialog open onOpenChange={() => {}} /></ToastProvider>,
    locale,
  );
  const forms = markup.match(/<form\b[^>]*>/g) ?? [];
  expect(forms).toHaveLength(1);
  expect(forms[0]).toMatch(/\bnovalidate(?:=|\s|>)/i);
});
