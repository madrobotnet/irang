import type { MetadataRoute } from "next";

/** Served at /manifest.webmanifest (public in src/proxy.ts). Share target posts into the inbox. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "세컨드 브레인",
    short_name: "세컨드 브레인",
    description: "캡처하고, 정리하고, 연결하는 개인 노트 작업대",
    lang: "ko",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#efe8dc",
    theme_color: "#c45c26",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    share_target: {
      action: "/api/capture/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
