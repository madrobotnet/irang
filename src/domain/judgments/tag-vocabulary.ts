/** Closed tag vocabulary for Jev noul proposals (never auto-applied). */

export const CAPTURE_TAG_VOCABULARY: ReadonlyArray<{
  tag: string;
  description: string;
}> = [
  { tag: "reference", description: "Saved for later reading or reference" },
  { tag: "idea", description: "Personal idea, insight, or brainstorm" },
  { tag: "task", description: "Action item or todo" },
  { tag: "project", description: "Project-related planning or status" },
  { tag: "meeting", description: "Meeting notes or decisions" },
  { tag: "technical", description: "Technical documentation or how-to" },
  { tag: "personal", description: "Personal or journal-style note" },
];

export const TAG_SUGGESTION_MIN_PROBABILITY = 0.55;
