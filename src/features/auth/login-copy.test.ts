import { describe, expect, test } from "bun:test";
import { formatRemaining } from "./login-copy";

describe("formatRemaining", () => {
  test("rounds up to whole seconds and splits minutes", () => {
    expect(formatRemaining(0)).toBe("0초");
    expect(formatRemaining(0.2)).toBe("1초");
    expect(formatRemaining(45)).toBe("45초");
    expect(formatRemaining(60)).toBe("1분");
    expect(formatRemaining(65)).toBe("1분 5초");
    expect(formatRemaining(-3)).toBe("0초");
  });
});
