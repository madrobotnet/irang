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
  return {
    async stream(input, onDelta, outerSignal) {
      const signal = requestSignal(outerSignal, config.timeoutMs);
      const body = await postApiStream({
        url: config.url,
        headers: config.headers,
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
          // GenerateContentRequest.store controls request logging in the v1beta schema:
          // https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta
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
