import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { startNoteMaintenance } from "./trash";

const warn = spyOn(console, "warn").mockImplementation(() => undefined);
afterEach(() => warn.mockClear());
afterAll(() => warn.mockRestore());

const within = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms))]);

describe("scheduled note maintenance", () => {
  test("runs at once, again on its interval, and keeps the schedule after a failed run", async () => {
    let calls = 0;
    let reachedThird!: () => void;
    const third = new Promise<void>((resolve) => {
      reachedThird = resolve;
    });
    const stop = startNoteMaintenance(async () => {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error("storage down"), { code: "ECONNREFUSED" });
      if (calls === 3) reachedThird();
    }, 5);
    try {
      expect(calls).toBe(1);
      await within(third, 2000);
    } finally {
      stop();
    }
    expect(calls).toBe(3);
    expect(warn).toHaveBeenCalledWith("[maintenance] run failed", { code: "ECONNREFUSED" });
  });
});
