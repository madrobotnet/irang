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

const ChatCompletionEventSchema = z.looseObject({
  choices: z.array(z.looseObject({
    index: z.number().optional(),
    delta: z.looseObject({
      content: z.string().nullable().optional(),
    }).optional(),
    finish_reason: z.string().nullable().optional(),
  })),
});

export function createChatCompletionsApiProvider(config: ApiAdapterConfig): ChatProvider {
  return {
    async stream(input, onDelta, outerSignal) {
      const signal = requestSignal(outerSignal, config.timeoutMs);
      const body = await postApiStream({
        url: config.url,
        headers: config.headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: groundingInstruction(input) },
            ...input.history.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            { role: "user", content: groundedQuestion(input) },
          ],
          tools: [],
          stream: true,
          ...(config.maxOutputTokens === undefined ? {} : { max_tokens: config.maxOutputTokens }),
        }),
        signal,
        fetchImpl: config.fetchImpl,
      });

      let output = "";
      let didStop = false;
      let didReceiveDone = false;
      await consumeJsonSse(body, (rawEvent) => {
        const parsed = ChatCompletionEventSchema.safeParse(rawEvent);
        if (!parsed.success) throw new ChatProviderError();
        const choice = parsed.data.choices.find((item) => item.index === undefined || item.index === 0);
        if (!choice) return;
        if (choice.delta?.content) {
          output += choice.delta.content;
          onDelta(choice.delta.content);
        }
        if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
          if (choice.finish_reason !== "stop") throw new ChatProviderError();
          didStop = true;
        }
      }, () => {
        didReceiveDone = true;
      });
      if (!didStop || !didReceiveDone || !output.trim()) throw new ChatProviderError();
      return output;
    },
  };
}
