import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

it("ships an installable manifest with the three home entries", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8")) as {
    name?: string;
    display?: string;
    icons?: { src: string; sizes: string; type: string }[];
  };
  const home = readFileSync(new URL("../../src/app/page.tsx", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  assert.equal(manifest.name, "세컨드 브레인");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons?.some((icon) => icon.sizes === "192x192"), true);
  assert.equal(manifest.icons?.some((icon) => icon.sizes === "512x512"), true);
  assert.equal(home.includes("검색"), true);
  assert.equal(home.includes("받은 편지함"), true);
  assert.equal(home.includes("AI 채팅"), true);
  assert.equal(home.includes("data-app-shell=\"brain\""), true);
  assert.equal(worker.includes("fetch"), true);
});
