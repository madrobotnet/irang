import { afterEach, describe, expect, it } from "vitest";
import { evaluateCaptureJudgments } from "./capture-judgments";
import { setSystemOneInvokerForTests } from "./runtime";
import { mockSystemOneInvoker } from "./test-helpers";

afterEach(() => {
  setSystemOneInvokerForTests(null);
});

describe("evaluateCaptureJudgments", () => {
  it("maps tag suggestions and duplicate choice from TypeSafe answers", async () => {
    setSystemOneInvokerForTests(
      mockSystemOneInvoker({
        tag_idea: { type: "noul", noul: 0.82 },
        tag_task: { type: "noul", noul: 0.6 },
        duplicate_match: {
          type: "choice",
          choice: "note-a",
          confidence: 0.77,
          probabilities: { none: 0.1, "note-a": 0.77 },
        },
      }),
    );

    const result = await evaluateCaptureJudgments({
      title: "My idea",
      body: "Build a second brain",
      candidates: [{ id: "note-a", title: "Brain", body: "second brain idea" }],
    });

    expect(result.suggestions.tags.map((t) => t.tag)).toEqual(["idea", "task"]);
    expect(result.duplicateHint).toMatchObject({
      relatedNoteId: "note-a",
      choice: "note-a",
      confidence: 0.77,
    });
  });

  it("omits duplicate question when there are no candidate notes", async () => {
    let questionKeys: string[] = [];
    const inner = mockSystemOneInvoker({
      tag_reference: { type: "noul", noul: 0.9 },
    });
    setSystemOneInvokerForTests({
      async systemOne(request) {
        questionKeys = Object.keys(request.questions);
        return inner.systemOne(request);
      },
    });

    const result = await evaluateCaptureJudgments({
      title: "Read later",
      body: "Article link",
      candidates: [],
    });

    expect(questionKeys).not.toContain("duplicate_match");
    expect(result.duplicateHint).toBeNull();
    expect(result.suggestions.tags[0]?.tag).toBe("reference");
  });
});
