import { describe, expect, it } from "vitest";
import { swipeIntent } from "./swipe";

describe("swipeIntent", () => {
  it("maps right to promote and left to discard", () => {
    expect(swipeIntent(80, 0)).toBe("promote");
    expect(swipeIntent(-90, 10)).toBe("discard");
  });

  it("ignores short drags and vertical scrolls", () => {
    expect(swipeIntent(40, 0)).toBeNull();
    expect(swipeIntent(80, 120)).toBeNull();
  });
});
