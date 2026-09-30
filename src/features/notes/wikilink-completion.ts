import type { NoteTitleMatch } from "@/lib/types";

/** An open `[[` target before the cursor: no `]`, `|`, `#` or line break yet. */
export const OPEN_WIKILINK = /\[\[[^\]\n|#]*$/;
const LINK_TARGET_UNSAFE = /[[\]|#\n]/;

export type WikiLinkOption =
  | { kind: "title"; noteId: string; label: string; insert: string }
  | { kind: "alias"; noteId: string; label: string; title: string; insert: string }
  | { kind: "create"; title: string; insert: string };

/** The server's title key: trimmed, inner whitespace collapsed, case-insensitive. */
export function linkNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Rows in server rank order; `insert` is the link body, and a create row ends the list when nothing matches exactly. */
export function wikiLinkOptions(matches: readonly NoteTitleMatch[], typed: string): WikiLinkOption[] {
  const query = typed.trim();
  const key = linkNameKey(query);
  const seen = new Set<string>();
  const options: WikiLinkOption[] = [];
  let exact = false;
  for (const match of matches) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    const alias = match.matchedAlias?.trim();
    if (alias) {
      exact ||= linkNameKey(alias) === key;
      const insert = LINK_TARGET_UNSAFE.test(match.title) ? alias : `${match.title}|${alias}`;
      options.push({ kind: "alias", noteId: match.id, label: alias, title: match.title, insert });
    } else {
      exact ||= linkNameKey(match.title) === key;
      options.push({ kind: "title", noteId: match.id, label: match.title, insert: match.title });
    }
  }
  if (query && !exact && !LINK_TARGET_UNSAFE.test(query)) options.push({ kind: "create", title: query, insert: query });
  return options;
}

/** Characters after the cursor that a completion replaces: the `]]` closeBrackets already typed. */
export function closingBracketsAfter(textAfter: string): number {
  return textAfter.startsWith("]]") ? 2 : 0;
}
