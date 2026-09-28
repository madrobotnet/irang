import { afterEach, expect, test } from "bun:test";
import { noul } from "@typesafe-ai/sdk";
import { z } from "zod";
import { createJevClient } from "./client";

const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  servers.splice(0).forEach((server) => server.stop(true));
});

const capturedRequest = z.object({
  model: z.string(),
  state: z.object({ itemId: z.string() }),
  questions: z.object({ relevant: z.object({ type: z.literal("noul") }) }),
});

test.each([
  ["typesafe", "https://api.typesafe.ai/v1/systemone", "jev-1.13"],
  ["openrouter", "https://openrouter.ai/api/v1/systemone", "~typesafe/jev-latest"],
] as const)("routes %s through the actual SDK with its selected model and typed answer", async (provider, endpoint, model) => {
  const requests: { endpoint: string; authorization: string | null; body: unknown }[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      requests.push({ endpoint, authorization: request.headers.get("authorization"), body: await request.json() });
      return Response.json({
        model: "typesafe/jev-1.13",
        answers: { relevant: { type: "noul", noul: 0.87 } },
        usage: { input_tokens: 20, output_tokens: 1, cost: 0 },
        provider: "TypeSafe",
      });
    },
  });
  servers.push(server);
  const destinations: string[] = [];
  const client = createJevClient({ provider, model, apiKey: "fixture-provider-key" }, async (url, init) => {
    destinations.push(url);
    return fetch(new URL(new URL(url).pathname, server.url), init);
  });

  const response = await client.systemOne({ state: { itemId: "capture-1" }, questions: { relevant: noul() } });

  expect(destinations).toEqual([endpoint]);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.authorization).toBe("Bearer fixture-provider-key");
  const body = capturedRequest.parse(requests[0]?.body);
  expect(body.model).toBe(model);
  expect(body.state).toEqual({ itemId: "capture-1" });
  expect(response.answers.relevant.noul).toBe(0.87);
});

test("does not multiply optional-provider requests when the upstream rejects them", async () => {
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch() {
      requests += 1;
      return Response.json({ error: "fixture-unavailable" }, { status: 503 });
    },
  });
  servers.push(server);
  const client = createJevClient(
    { provider: "openrouter", model: "typesafe/jev-1.13", apiKey: "fixture-provider-key" },
    (_url, init) => fetch(server.url, init),
  );

  // Assimilate the SDK's APIPromise through its public then/await contract.
  const result = Promise.resolve(client.systemOne({ state: {}, questions: { relevant: noul() } }));
  await expect(result).rejects.toThrow();
  expect(requests).toBe(1);
});
