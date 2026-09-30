import { expect, test } from "bun:test";
import { buttonClassName, type ButtonSize } from "./Button";

const sizes: ButtonSize[] = ["sm", "md", "lg"];

test.each(sizes)("icon-only %s buttons do not inherit text-button horizontal padding", (size) => {
  const padding = buttonClassName({ size, iconOnly: true }).split(" ").filter((token) => token.startsWith("px-"));
  expect(padding).toEqual(["px-0"]);
});

test.each(sizes)("text %s buttons retain their size padding", (size) => {
  const padding = buttonClassName({ size }).split(" ").filter((token) => token.startsWith("px-"));
  expect(padding).toHaveLength(1);
  expect(padding).not.toContain("px-0");
});
