export const MAX_CONTEXT_NOTES = 10;
export const MAX_CONTEXT_CHARS = 32_000;

export type ContextNote = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
};

export function limitContext(notes: readonly ContextNote[]): readonly ContextNote[] {
  const selected: ContextNote[] = [];
  let used = 0;
  for (const note of notes.slice(0, MAX_CONTEXT_NOTES)) {
    const remaining = MAX_CONTEXT_CHARS - used;
    if (remaining <= 0) break;
    const body = note.body.slice(0, remaining);
    selected.push({ id: note.id, title: note.title, body });
    used += body.length;
  }
  return selected;
}

export function cite(notes: readonly ContextNote[]): string {
  return notes.map((note) => `[${note.title}](/notes/${note.id})`).join(" ");
}
