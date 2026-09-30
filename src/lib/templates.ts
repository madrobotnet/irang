/** Wire shape returned by /api/templates. */
export type NoteTemplate = {
  id: string;
  name: string;
  body: string;
  /** At most one template is the daily-note default. */
  isDailyDefault: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export const TEMPLATE_NAME_MAX = 100;
/** Same bound as note bodies (api/notes routes). */
export const TEMPLATE_BODY_MAX = 2_000_000;

export const TEMPLATE_VARIABLES = ["date", "title"] as const;
export type TemplateContext = {
  /** YYYY-MM-DD. */
  readonly date: string;
  readonly title: string;
};

const PLACEHOLDER = /\{\{\s*(date|title)\s*\}\}/g;

/** Replace known placeholders; unknown {{vars}} stay as written. */
export function renderTemplate(body: string, ctx: TemplateContext): string {
  // A replacer function keeps `$&`-style sequences in the values literal.
  return body.replace(PLACEHOLDER, (_match, name: (typeof TEMPLATE_VARIABLES)[number]) => ctx[name]);
}
