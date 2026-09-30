import type { ProviderInput } from "./provider";

export const TEST_INPUT = {
  locale: "ko",
  question: "회의는 언제야?",
  history: [
    { role: "user", content: "지난 답을 기억해줘." },
    { role: "assistant", content: "기억했습니다." },
  ],
  sources: [
    { noteId: "note-17", title: "회의 기록", excerpt: "회의는 금요일 오전이다." },
  ],
} as const satisfies ProviderInput;

export function fragmentedResponse(parts: readonly string[]): Response {
  let index = 0;
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      const part = parts[index++];
      if (part === undefined) controller.close();
      else controller.enqueue(new TextEncoder().encode(part));
    },
  }), { headers: { "content-type": "text/event-stream" } });
}
