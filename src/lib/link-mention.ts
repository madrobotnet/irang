export type MentionTarget = { readonly title: string; readonly aliases: readonly string[] };

const MASK = "\u0000";
// Regions where inserting [[...]] would change code, an existing link, a URL, markup, or a tag.
const PROTECTED: readonly RegExp[] = [
  // A fence closes only on a run at least as long as the one that opened it.
  /(`{3,})[\s\S]*?(?:\1|$)/g,
  /(~{3,})[\s\S]*?(?:\1|$)/g,
  /(`+)[^\n]*?\1/g,
  /<!--[\s\S]*?(?:-->|$)/g,
  /\[\[[^\]\n]*\]\]/g,
  /!?\[[^\]\n]*\]\([^)\n]*\)/g,
  /!?\[[^\]\n]*\]\[[^\]\n]*\]/g,
  /^[ \t]{0,3}\[[^\]\n]+\]:[^\n]*/gm,
  /<\/?[a-z][^>\n]*>/gi,
  /\b(?:https?:\/\/|www\.)[^\s<>]*/gi,
];
const TAG_RE = /(^|[\s(])(#[\p{L}\p{N}_][\p{L}\p{N}_\-/]*)/gu;
const UNLINKABLE_NAME = /[[\]\n]/;
const LINK_TARGET_UNSAFE = /[[\]|#\n]/;
const WORD_CHAR = /[\p{L}\p{M}\p{N}_]/u;
// Scripts written without spaces between words; particles attach directly (바질은 -> 바질 + 은).
const UNSPACED_SCRIPT = /[\p{sc=Hangul}\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Thai}]/u;

function maskProtected(body: string): string {
  const hide = (text: string): string => MASK.repeat(text.length);
  let masked = body;
  for (const pattern of PROTECTED) masked = masked.replace(pattern, hide);
  return masked.replace(TAG_RE, (_match, lead: string, tag: string) => lead + hide(tag));
}

const spacedWordChar = (char: string | undefined): boolean =>
  char !== undefined && WORD_CHAR.test(char) && !UNSPACED_SCRIPT.test(char);
const lastChar = (text: string): string | undefined => Array.from(text.slice(-2)).at(-1);
const firstChar = (text: string): string | undefined => {
  const point = text.codePointAt(0);
  return point === undefined ? undefined : String.fromCodePoint(point);
};

/** Latin-style words must not be split ("Art" in "Party"); unspaced scripts need no boundary. */
function standsAlone(text: string, start: number, match: string): boolean {
  const before = lastChar(text.slice(0, start));
  const after = firstChar(text.slice(start + match.length));
  const splitsStart = spacedWordChar(before) && spacedWordChar(firstChar(match));
  const splitsEnd = spacedWordChar(lastChar(match)) && spacedWordChar(after);
  return !splitsStart && !splitsEnd;
}

function namePattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[ \\t]+");
  return new RegExp(escaped, "giu");
}

type Occurrence = { start: number; text: string };

function firstOccurrence(masked: string, names: readonly string[]): Occurrence | null {
  let best: Occurrence | null = null;
  for (const name of names) {
    for (const match of masked.matchAll(namePattern(name))) {
      const start = match.index;
      if (best && start > best.start) break;
      if (!standsAlone(masked, start, match[0])) continue;
      if (!best || start < best.start || match[0].length > best.text.length) best = { start, text: match[0] };
      break;
    }
  }
  return best;
}

/**
 * Wrap the first plain-text mention of the target's title or an alias as [[Title]] (or
 * [[Title|as written]] when the spelling differs). Returns null when no linkable mention remains.
 */
export function linkFirstMention(body: string, target: MentionTarget): string | null {
  const names = [...new Set([target.title, ...target.aliases].map((name) => name.trim()))]
    .filter((name) => name && !UNLINKABLE_NAME.test(name));
  const linkName = names.find((name) => !LINK_TARGET_UNSAFE.test(name));
  if (!linkName) return null;
  const found = firstOccurrence(maskProtected(body), names);
  if (!found) return null;
  const link = found.text === linkName ? `[[${linkName}]]` : `[[${linkName}|${found.text}]]`;
  return body.slice(0, found.start) + link + body.slice(found.start + found.text.length);
}
