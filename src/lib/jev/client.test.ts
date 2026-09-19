import { describe, expect, it } from "vitest";
import { createJevClient } from "./client";
import { JevClientError } from "./errors";

const sampleRequest = {
  state: "Duplicate charge on order A-104.",
  questions: {
    needs_review: {
      type: "noul" as const,
      instructions: "Does this need human review?",
    },
  },
};

describe("createJevClient", () => {
  it("fails explicitly when TYPESAFE_API_KEY is missing", async () => {
    const client = createJevClient({ config: { apiKey: null, model: "jev-latest" } });
    await expect(client.systemOne(sampleRequest)).rejects.toMatchObject({
      name: "JevClientError",
      code: "missing_api_key",
    });
  });

  it("does not silently skip when key is present but sink is unwired", async () => {
    const client = createJevClient({
      config: { apiKey: "ts_test_only", model: "jev-latest" },
    });
    await expect(client.systemOne(sampleRequest)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(JevClientError);
      expect((err as JevClientError).code).toBe("seat_not_wired");
      return true;
    });
  });
});
