import type { Metadata, Viewport } from "next";
import { RAIL_INIT_SCRIPT } from "@/components/shell/rail";
import { THEME_INIT_SCRIPT } from "@/components/shell/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "세컨드 브레인", template: "%s · 세컨드 브레인" },
  description: "캡처하고, 정리하고, 연결하는 개인 노트 작업대",
  applicationName: "세컨드 브레인",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-48.png", sizes: "48x48" }], apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "세컨드 브레인" },
  robots: { index: false, follow: false },
};

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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + RAIL_INIT_SCRIPT }} />
      </head>
      <body className="bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
