import { describe, expect, it } from "vitest";
import { INBOX_CLASS_VOCABULARY, isInboxClassId } from "@/domain/inbox/classification";
import { CAPTURE_TAG_VOCABULARY } from "@/domain/judgments/tag-vocabulary";
import { evaluateCaptureJudgments } from "./capture-judgments";
import { setSystemOneInvokerForTests } from "./runtime";

const runLive = process.env.RUN_TYPESAFE_PROOF === "1" && Boolean(process.env.TYPESAFE_API_KEY);

describe.runIf(runLive)("live TypeSafe inbox classification", () => {
  it("returns a vocabulary class and vocabulary tags", async () => {
    setSystemOneInvokerForTests(null);
    const result = await evaluateCaptureJudgments({
      title: "Ship inbox promote",
      body: "Task: finish the inbox promote and discard API without applying tags automatically.",
      candidates: [],
      includeClassification: true,
    });
    const classification = result.suggestions.classification;
    expect(classification).toBeTruthy();
    expect(isInboxClassId(classification!.choice)).toBe(true);
    expect(INBOX_CLASS_VOCABULARY.some((entry) => entry.id === classification!.choice)).toBe(true);
    for (const tag of result.suggestions.tags) {
      expect(CAPTURE_TAG_VOCABULARY.some((entry) => entry.tag === tag.tag)).toBe(true);
      expect(tag.probability).toBeGreaterThanOrEqual(0);
      expect(tag.probability).toBeLessThanOrEqual(1);
    }
  });
});
