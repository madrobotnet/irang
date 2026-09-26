import type { Metadata } from "next";
import { headers } from "next/headers";
import { Noto_Sans_KR } from "next/font/google";
import { CSP_NONCE_HEADER } from "@/lib/auth/security-headers";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "Second Brain",
  description: "brain.madrobot.net",
  icons: {
    icon: "/icons/icon-48.png",
    apple: "/icons/icon-48.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get(CSP_NONCE_HEADER) ?? undefined;

  return (
    <html lang="ko" data-theme="light" suppressHydrationWarning nonce={nonce}>
      <body className={notoSansKr.variable}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
