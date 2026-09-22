import { CAPTURE_TAG_VOCABULARY } from "@/domain/judgments/tag-vocabulary";
import type { Questions, SystemOneResult } from "@typesafe-ai/sdk";
import type { SystemOneInvoker } from "./ports";

export function mockSystemOneInvoker(
  overrides: Record<string, unknown> = {},
): SystemOneInvoker {
  const answers: Record<string, unknown> = {};
  for (const entry of CAPTURE_TAG_VOCABULARY) {
    answers[`tag_${entry.tag}`] = { type: "noul", noul: 0.2 };
  }
  Object.assign(answers, {
    duplicate_match: {
      type: "choice",
      choice: "none",
      confidence: 0.9,
      probabilities: { none: 0.9 },
    },
    ...overrides,
  });
  return {
    async systemOne<Q extends Questions>(): Promise<SystemOneResult<Q>> {
      return {
        model: "jev-latest",
        usage: { input_tokens: 1, output_tokens: 1 },
        answers,
      } as SystemOneResult<Q>;
    },
  };
}
