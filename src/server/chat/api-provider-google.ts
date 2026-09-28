import { z } from "zod";
import { consumeJsonSse } from "./api-provider-stream";
import {
  type ApiAdapterConfig,
  GROUNDING_INSTRUCTIONS,
  groundedQuestion,
  postApiStream,
  requestSignal,
} from "./api-provider-shared";
import { ChatProviderError, type ChatProvider } from "./provider";

const GoogleResponseSchema = z.looseObject({
  candidates: z.array(z.looseObject({
    index: z.number().optional(),
    finishReason: z.string().optional(),
    content: z.object({
      parts: z.array(z.looseObject({
        text: z.string().optional(),
        thought: z.boolean().optional(),
      })),
    }).optional(),
  })).optional(),
});

export function createGoogleApiProvider(config: ApiAdapterConfig): ChatProvider {
  const model = config.model.startsWith("models/") ? config.model.slice("models/".length) : config.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${
    encodeURIComponent(model)
  }:streamGenerateContent?alt=sse`;

  return {
    async stream(input, onDelta, outerSignal) {
      const signal = requestSignal(outerSignal, config.timeoutMs);
      const body = await postApiStream({
        url,
        headers: {
          "x-goog-api-key": config.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: GROUNDING_INSTRUCTIONS }] },
          contents: [
            ...input.history.map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
            { role: "user", parts: [{ text: groundedQuestion(input) }] },
          ],
          tools: [],
          store: false,
        }),
        signal,
        fetchImpl: config.fetchImpl,
      });

      let output = "";
      let finishReason = "";
      await consumeJsonSse(body, (rawEvent) => {
        const parsed = GoogleResponseSchema.safeParse(rawEvent);
        if (!parsed.success) throw new ChatProviderError();
        const candidate = parsed.data.candidates?.find((item) => item.index === undefined || item.index === 0);
        if (!candidate) return;
        for (const part of candidate.content?.parts ?? []) {
          if (part.text && part.thought !== true) {
            output += part.text;
            onDelta(part.text);
          }
        }
        if (candidate.finishReason) {
          if (candidate.finishReason !== "STOP") throw new ChatProviderError();
          finishReason = candidate.finishReason;
        }
      });
      if (finishReason !== "STOP" || !output.trim()) throw new ChatProviderError();
      return output;
    },
  };
}
