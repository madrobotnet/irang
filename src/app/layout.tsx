import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="ko" style={{ colorScheme: "dark" }}>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
