import type { MetadataRoute } from "next";

/**
 * Web app manifest seat for add-to-home-screen.
 * Served by the Next metadata route at `/manifest.webmanifest`.
 * Online-only: no service worker and no offline cache.
 *
 * `/manifest.webmanifest` and these icon URLs are public assets, same
 * convention as `/favicon.ico`. Home data stays on the verified-session gate.
 */
export const WEB_APP_MANIFEST_PATH = "/manifest.webmanifest" as const;

export const WEB_APP_MANIFEST: MetadataRoute.Manifest = {
  name: "Second Brain",
  short_name: "Second Brain",
  description: "brain.madrobot.net",
  lang: "ko",
  id: "/",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#efe8dc",
  theme_color: "#c45c26",
  icons: [
    {
      src: "/icons/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ],
};
