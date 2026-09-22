import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="ko" style={{ colorScheme: "dark" }}>
      <body>{children}</body>
    </html>
  );
}
