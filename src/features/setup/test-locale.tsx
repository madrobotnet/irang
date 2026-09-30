import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import type { CopyTree } from "@/lib/i18n/copy";
import type { Locale } from "@/lib/i18n/locale";

/** Test helpers for localized components. Not imported by app code. */

/** Static markup rendered inside a LocaleProvider, as the app renders it. */
export function renderInLocale(node: ReactNode, locale: Locale = "en"): string {
  return renderToStaticMarkup(<LocaleProvider initialLocale={locale}>{node}</LocaleProvider>);
}

/**
 * The element tree a component returns, produced during a real render so its hooks
 * (useCopy, useLocale) resolve. Handlers in the returned tree stay callable afterwards.
 */
export function captureTree<P>(component: (props: P) => ReactNode, props: P, locale: Locale = "en"): ReactNode {
  let tree: ReactNode = null;
  function Capture() {
    tree = component(props);
    return null;
  }
  renderInLocale(<Capture />, locale);
  return tree;
}

/** Text as React escapes it in markup, for shipped-copy equality checks. */
export function html(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;

/** Paths of copy leaves containing Hangul; functions are called with placeholder arguments. */
export function hangulLeaks(tree: CopyTree, path = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === "string") return HANGUL.test(value) ? [at] : [];
    if (typeof value === "function") {
      const text = (value as (...args: unknown[]) => string)(...Array.from({ length: value.length }, () => 1));
      return HANGUL.test(text) ? [at] : [];
    }
    return hangulLeaks(value, at);
  });
}

/** Markup fragments (text or attribute runs) that contain Hangul. */
export function hangulIn(markup: string): string[] {
  return markup.match(/[^<>"]*[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af][^<>"]*/g) ?? [];
}
