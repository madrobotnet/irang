import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
type Rgb = readonly [number, number, number];
const pairs = [
  ["mute", "canvas"], ["mute", "card"], ["accent", "canvas"], ["accent", "accent-soft"],
  ["accent-ink", "accent"], ["ok", "ok-soft"], ["ok", "canvas"],
  ["warn", "canvas"], ["warn", "warn-soft"],
] as const;

function colors(selector: string) {
  const block = css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!block) throw new Error(`Missing theme ${selector}`);
  const values = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*#([a-f0-9]{6});/gi)].map((match) => [match[1], match[2]]));
  return (name: string) => {
    const value = values[name];
    if (!value) throw new Error(`Missing ${selector} token ${name}`);
    const channel = (start: number) => Number.parseInt(value.slice(start, start + 2), 16) / 255;
    return [channel(0), channel(2), channel(4)] as const;
  };
}

function luminance(rgb: Rgb) {
  const linear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return linear(rgb[0]) * 0.2126 + linear(rgb[1]) * 0.7152 + linear(rgb[2]) * 0.0722;
}

function contrast(first: Rgb, second: Rgb) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const theme of [":root", "\\.dark"]) {
  const color = colors(theme);
  test.each([...pairs])(`${theme} small text %s on %s meets AA contrast`, (foreground, background) => {
    expect(contrast(color(foreground), color(background))).toBeGreaterThanOrEqual(4.5);
  });

  test(`${theme} placeholder text remains readable on a card`, () => {
    const rule = css.match(/textarea::placeholder\s*\{([\s\S]*?)\}/)?.[1];
    const opacity = Number(rule?.match(/opacity:\s*([\d.]+)/)?.[1]);
    expect(Number.isFinite(opacity)).toBe(true);
    const background = color("card");
    const mute = color("mute");
    const channel = (index: 0 | 1 | 2) => mute[index] * opacity + background[index] * (1 - opacity);
    const foreground = [channel(0), channel(1), channel(2)] as const;
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
}
