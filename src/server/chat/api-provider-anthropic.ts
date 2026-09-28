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

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const AnthropicEventSchema = z.looseObject({
  type: z.string(),
  delta: z.object({
    type: z.string().optional(),
    text: z.string().optional(),
    stop_reason: z.string().nullable().optional(),
  }).optional(),
});

export function createAnthropicApiProvider(config: ApiAdapterConfig): ChatProvider {
  return {
    async stream(input, onDelta, outerSignal) {
      const signal = requestSignal(outerSignal, config.timeoutMs);
      const body = await postApiStream({
        url: ANTHROPIC_MESSAGES_URL,
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          system: GROUNDING_INSTRUCTIONS,
          messages: [
            ...input.history.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            { role: "user", content: groundedQuestion(input) },
          ],
          tools: [],
          stream: true,
        }),
        signal,
        fetchImpl: config.fetchImpl,
      });

      let output = "";
      let successfulStop = false;
      let didStop = false;
      await consumeJsonSse(body, (rawEvent) => {
        const parsed = AnthropicEventSchema.safeParse(rawEvent);
        if (!parsed.success) throw new ChatProviderError();
        const event = parsed.data;
        switch (event.type) {
          case "error":
            throw new ChatProviderError();
          case "content_block_delta":
            if (event.delta?.type === "text_delta" && event.delta.text) {
              output += event.delta.text;
              onDelta(event.delta.text);
            }
            break;
          case "message_delta":
            successfulStop = event.delta?.stop_reason === "end_turn"
              || event.delta?.stop_reason === "stop_sequence";
            break;
          case "message_stop":
            didStop = true;
            break;
        }
      });
      if (!didStop || !successfulStop || !output.trim()) throw new ChatProviderError();
      return output;
    },
  };
}
