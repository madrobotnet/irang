import type { Metadata, Viewport } from "next";
import { DefaultDocumentTitle } from "@/components/i18n/DocumentTitle";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { RAIL_INIT_SCRIPT } from "@/components/shell/rail";
import { THEME_INIT_SCRIPT } from "@/components/shell/theme";
import { rootMetadata } from "@/lib/brand";
import { getRequestLocale } from "@/lib/i18n/server";
import "./globals.css";

/** Brand title template, description, install name and icons, in this request's locale. */
export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata(await getRequestLocale());
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe8dc" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};

/**
 * The two inline scripts run before hydration so the first paint already has
 * the persisted theme class and rail width; suppressHydrationWarning covers
 * exactly the <html> attributes they touch.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + RAIL_INIT_SCRIPT }} />
      </head>
      <body className="bg-canvas text-ink antialiased">
        <LocaleProvider initialLocale={locale}>
          {/* After a client-side language switch, the root default title (the brand) follows it. */}
          <DefaultDocumentTitle />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
