import { z } from "zod";
import { consumeJsonSse } from "./api-provider-stream";
import {
  type ApiAdapterConfig,
  groundedQuestion,
  groundingInstruction,
  postApiStream,
  requestSignal,
} from "./api-provider-shared";
import { ChatProviderError, type ChatProvider } from "./provider";

const OpenAiResponseValueSchema = z.looseObject({
  output_text: z.string().optional(),
  output: z.array(z.looseObject({
    content: z.array(z.looseObject({
      text: z.string().optional(),
    })).optional(),
  })).optional(),
});
const OpenAiResponseEventSchema = OpenAiResponseValueSchema.extend({
  type: z.string(),
  delta: z.string().optional(),
  response: OpenAiResponseValueSchema.optional(),
});

function responseText(value: z.infer<typeof OpenAiResponseValueSchema>): string {
  if (value.output_text) return value.output_text;
  return value.output?.flatMap((item) => item.content ?? [])
    .flatMap((content) => content.text ?? [])
    .join("") ?? "";
}

export function createOpenAiApiProvider(config: ApiAdapterConfig): ChatProvider {
  return {
    async stream(input, onDelta, outerSignal) {
      const signal = requestSignal(outerSignal, config.timeoutMs);
      const body = await postApiStream({
        url: config.url,
        headers: config.headers,
        body: JSON.stringify({
          model: config.model,
          instructions: groundingInstruction(input),
          input: [
            ...input.history.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            { role: "user", content: groundedQuestion(input) },
          ],
          tools: [],
          store: false,
          stream: true,
          ...(config.maxOutputTokens === undefined ? {} : { max_output_tokens: config.maxOutputTokens }),
        }),
        signal,
        fetchImpl: config.fetchImpl,
      });

      let output = "";
      let completed = "";
      let didComplete = false;
      await consumeJsonSse(body, (rawEvent) => {
        const parsed = OpenAiResponseEventSchema.safeParse(rawEvent);
        if (!parsed.success) throw new ChatProviderError();
        const event = parsed.data;
        switch (event.type) {
          case "error":
          case "response.failed":
          case "response.incomplete":
            throw new ChatProviderError();
          case "response.output_text.delta":
            if (event.delta) {
              output += event.delta;
              onDelta(event.delta);
            }
            break;
          case "response.completed":
            didComplete = true;
            completed = responseText(event.response ?? event);
            break;
        }
      });
      const text = completed.trim() || output;
      if (!didComplete || !text.trim()) throw new ChatProviderError();
      return text;
    },
  };
}
