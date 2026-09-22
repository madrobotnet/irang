/** Closed primary class for an inbox item. A suggestion, never an applied tag. */

export const INBOX_CLASS_VOCABULARY = [
  { id: "reference", description: "Saved for later reading or reference." },
  { id: "idea", description: "Personal idea, insight, or brainstorm." },
  { id: "task", description: "Action item or todo." },
  { id: "project", description: "Project-related planning or status." },
  { id: "meeting", description: "Meeting notes or decisions." },
  { id: "technical", description: "Technical documentation or how-to." },
  { id: "personal", description: "Personal or journal-style note." },
  {
    id: "unsorted",
    description: "None of the other classes fit this inbox item.",
  },
] as const;

export type InboxClassId = (typeof INBOX_CLASS_VOCABULARY)[number]["id"];

const CLASS_IDS: ReadonlySet<string> = new Set(
  INBOX_CLASS_VOCABULARY.map((entry) => entry.id),
);

export function isInboxClassId(value: string): value is InboxClassId {
  return CLASS_IDS.has(value);
}

export type InboxClassification = {
  choice: InboxClassId;
  probability: number;
  confidence: number;
  probabilities: Record<InboxClassId, number>;
};
