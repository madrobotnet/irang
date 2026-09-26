import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { E6_PUBLIC_PWA_PATHS } from "@/lib/auth/e6-gate-paths";
import { ONLINE_ONLY_BANNER_COPY } from "./copy";
import { WEB_APP_MANIFEST, WEB_APP_MANIFEST_PATH } from "./manifest";
import manifest from "@/app/manifest";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPublic(publicPath: string): Buffer {
  const relative = publicPath.replace(/^\//, "");
  return readFileSync(path.join(process.cwd(), "public", relative));
}

function pngSize(publicPath: string): { width: number; height: number } {
  const buf = readPublic(publicPath);
  expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(buf.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function sha256(publicPath: string): string {
  return createHash("sha256").update(readPublic(publicPath)).digest("hex");
}

describe("E6 PWA manifest seat", () => {
  it("exposes a standalone manifest for the home start URL", () => {
    const served = manifest();
    expect(served).toMatchObject(WEB_APP_MANIFEST);
    expect(served.share_target).toEqual({
      action: "/api/capture/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url" },
    });
    expect(WEB_APP_MANIFEST_PATH).toBe("/manifest.webmanifest");
    expect(E6_PUBLIC_PWA_PATHS).toContain(WEB_APP_MANIFEST_PATH);
    expect(WEB_APP_MANIFEST.name).toBe("Second Brain");
    expect(WEB_APP_MANIFEST.short_name).toBe("Second Brain");
    expect(WEB_APP_MANIFEST.start_url).toBe("/");
    expect(WEB_APP_MANIFEST.display).toBe("standalone");
    expect(WEB_APP_MANIFEST.background_color).toBe("#110e16");
    expect(WEB_APP_MANIFEST.theme_color).toBe("#110e16");
    expect(WEB_APP_MANIFEST).not.toHaveProperty("serviceworker");
    expect(JSON.stringify(WEB_APP_MANIFEST)).not.toMatch(/serviceWorker|workbox|offline/i);
  });

  it("points public icon files at 192 and 512 pngs", () => {
    const icons = WEB_APP_MANIFEST.icons ?? [];
    expect(icons.map((icon) => icon.src)).toEqual(["/icons/icon-192.png", "/icons/icon-512.png"]);
    for (const icon of icons) {
      expect(E6_PUBLIC_PWA_PATHS).toContain(icon.src);
      expect(icon.type).toBe("image/png");
      expect(icon.purpose).toBe("any");
    }
    expect(pngSize("/icons/icon-192.png")).toEqual({ width: 192, height: 192 });
    expect(pngSize("/icons/icon-512.png")).toEqual({ width: 512, height: 512 });
    expect(pngSize("/icons/icon-48.png")).toEqual({ width: 48, height: 48 });
    expect(sha256("/icons/icon-192.png")).toBe(
      "62a84ac1cbcc4f8b8ebe1e4a7a6ff1c43ea5a5d5a95f6aab857e500e97e91105",
    );
    expect(sha256("/icons/icon-512.png")).toBe(
      "0670285fbd70bc6a0f6d21b6678a7b30cc40e845ef469c4f460186a71ff73fe2",
    );
  });

  it("seats the online-only banner copy", () => {
    expect(ONLINE_ONLY_BANNER_COPY).toBe("온라인에서만 동작해요");
  });
});
