import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import type { NoulQuestion } from "@typesafe-ai/sdk";

export class TypeSafeMisconfiguredError extends Error {
  readonly name = "TypeSafeMisconfiguredError";

  constructor() {
    super("typesafe_misconfigured");
  }
}

class DuplicateJudgmentIncompleteError extends Error {
  readonly name = "DuplicateJudgmentIncompleteError";

  constructor(readonly candidateId: string) {
    super(`duplicate answer missing for ${candidateId}`);
  }
}

export type DuplicateCandidate = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
};

export type DuplicateJudgmentState = {
  readonly incoming: {
    readonly title: string;
    readonly body: string;
    readonly url: string | null;
  };
  readonly candidates: readonly DuplicateCandidate[];
};

export type DuplicateJudgment = {
  readonly candidates: readonly {
    readonly id: string;
    readonly probability: number;
  }[];
};

export async function selectEvidence(
  question: string,
  notes: readonly { readonly id: string; readonly title: string; readonly body: string }[],
): Promise<readonly { readonly id: string; readonly probability: number }[]> {
  const apiKey = process.env["TYPESAFE_API_KEY"]?.trim() ?? "";
  if (apiKey === "") throw new TypeSafeMisconfiguredError();
  if (question.trim() === "" || notes.length === 0) return [];
  const client = new TypeSafeClient();
  const questions: { [id: string]: NoulQuestion } = {};
  for (const note of notes) {
    questions[note.id] = noul({
      question: "Can this note support an answer to the question?",
      compare: "Compare the question with this note title and body.",
      relevant: "The note contains evidence that answers the question.",
      irrelevant: "The note does not answer the question.",
    });
  }
  const response = await client.systemOne({
    state: {
      question,
      notes: notes.map((note) => ({ id: note.id, title: note.title, body: note.body })),
    },
    questions,
  });
  return notes.flatMap((note) => {
    const answer = response.answers[note.id];
    if (answer === undefined || answer.noul < 0.5) return [];
    return [{ id: note.id, probability: answer.noul }];
  });
}

export async function suggestLabels(text: string): Promise<readonly { readonly label: string; readonly probability: number }[]> {
  const apiKey = process.env["TYPESAFE_API_KEY"]?.trim() ?? "";
  if (apiKey === "") throw new TypeSafeMisconfiguredError();
  if (text.trim() === "") return [];
  const client = new TypeSafeClient();
  const response = await client.systemOne({
    state: { text },
    questions: {
      label: noul({
        question: "What short Korean tag should be suggested for this inbox item?",
        compare: "Read `text` and propose one tag. Do not apply it.",
        tagged: "A short tag is appropriate.",
        untagged: "No tag should be suggested.",
      }),
    },
  });
  const answer = response.answers.label;
  if (answer === undefined || answer.noul < 0.5) return [];
  return [{ label: text.trim().slice(0, 24), probability: answer.noul }];
}

export async function judgeDuplicates(state: DuplicateJudgmentState): Promise<DuplicateJudgment> {
  const apiKey = process.env["TYPESAFE_API_KEY"]?.trim() ?? "";
  if (apiKey === "") throw new TypeSafeMisconfiguredError();
  if (state.candidates.length === 0) return { candidates: [] };

  const questions: { [id: string]: NoulQuestion } = {};
  for (const [index, candidate] of state.candidates.entries()) {
    const candidatePath = `candidates[${String(index)}]`;
    questions[candidate.id] = noul(
      {
        question:
          "Is this candidate a duplicate or near-duplicate of the incoming capture, close enough that a person should be offered a merge?",
        compare: `Compare \`incoming\` with \`${candidatePath}\`, including \`incoming.url\` when it is not null.`,
        duplicate: "The candidate restates the incoming capture and should be offered for merge.",
        distinct: "The candidate is a different note. Shared topic words alone are not a duplicate.",
      },
      {
        true: "Offer this candidate as a duplicate or near-duplicate.",
        false: "Do not offer this candidate. It is a distinct note.",
      },
    );
  }

  const client = new TypeSafeClient({ apiKey, logLevel: "off" });
  const result = await client.systemOne({
    model: "jev-latest",
    state: {
      incoming: {
        title: state.incoming.title,
        body: state.incoming.body,
        url: state.incoming.url,
      },
      candidates: state.candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        body: candidate.body,
      })),
    },
    questions,
  });

  return {
    candidates: state.candidates.map((candidate) => {
      const answer = result.answers[candidate.id];
      if (answer === undefined) throw new DuplicateJudgmentIncompleteError(candidate.id);
      return { id: candidate.id, probability: answer.noul };
    }),
  };
}
