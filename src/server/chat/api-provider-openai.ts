import { consumeResponseStream, type ChatProvider } from "./provider";
import {
  type ApiAdapterConfig,
  GROUNDING_INSTRUCTIONS,
  groundedQuestion,
  postApiStream,
  requestSignal,
} from "./api-provider-shared";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export function createOpenAiApiProvider(config: ApiAdapterConfig): ChatProvider {
  return {
    async stream(input, onDelta, outerSignal) {
      const signal = requestSignal(outerSignal, config.timeoutMs);
      const body = await postApiStream({
        url: OPENAI_RESPONSES_URL,
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          instructions: GROUNDING_INSTRUCTIONS,
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
        }),
        signal,
        fetchImpl: config.fetchImpl,
      });
      return consumeResponseStream(body, onDelta);
    },
  };
}
