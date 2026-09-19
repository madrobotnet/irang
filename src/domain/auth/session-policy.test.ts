import { describe, expect, it } from "vitest";
import { publicIdsToDropOldest } from "./session-policy";
import { MAX_CONCURRENT_SESSIONS, SESSION_TTL_MS } from "./constants";
import type { SessionRecord } from "./types";

function session(publicId: string, createdAt: number): SessionRecord {
  return {
    publicId,
    tokenHashHex: `hash-${publicId}`,
    createdAt,
    expiresAt: createdAt + SESSION_TTL_MS,
    revokedAt: null,
  };
}

describe("concurrent session cap", () => {
  const now = 1_000_000;

  it("drops nothing at the max of 5", () => {
    const sessions = [1, 2, 3, 4, 5].map((n) => session(`s${n}`, n));
    expect(publicIdsToDropOldest(sessions, now, MAX_CONCURRENT_SESSIONS)).toEqual([]);
  });

  it("drops the oldest when a 6th session appears", () => {
    const sessions = [1, 2, 3, 4, 5, 6].map((n) => session(`s${n}`, n * 10));
    expect(publicIdsToDropOldest(sessions, now)).toEqual(["s1"]);
  });

  it("drops multiple oldest if the store is over cap", () => {
    const sessions = [1, 2, 3, 4, 5, 6, 7].map((n) => session(`s${n}`, n));
    expect(publicIdsToDropOldest(sessions, now)).toEqual(["s1", "s2"]);
  });
});
