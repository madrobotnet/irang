/** Wikilink / tag parsing shared by server (link materialization) and client (rendering, autocomplete). */

export type WikiLink = {
  /** Raw target before '#' or '|', trimmed. */
  target: string;
  heading: string | null;
  label: string | null;
  /** Offsets of the whole [[...]] token in the source. */
  start: number;
  end: number;
};

const WIKILINK_RE = /\[\[([^\[\]\n|#]+)(?:#([^\[\]\n|]+))?(?:\|([^\[\]\n]+))?\]\]/g;
const FENCE_RE = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;
const TAG_RE = /(^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_\-/]*)/gu;

/** Replace code spans/blocks with spaces so offsets stay valid but code is ignored. */
function maskCode(body: string): string {
  return body.replace(FENCE_RE, (m) => " ".repeat(m.length));
}

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseWikiLinks(body: string): WikiLink[] {
  const masked = maskCode(body);
  const links: WikiLink[] = [];
  for (const m of masked.matchAll(WIKILINK_RE)) {
    const target = (m[1] ?? "").trim();
    if (!target) continue;
    links.push({
      target,
      heading: m[2]?.trim() || null,
      label: m[3]?.trim() || null,
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  return links;
}

/** Unique link targets (first spelling wins), compared case-insensitively. */
export function linkTargets(body: string): string[] {
  const seen = new Map<string, string>();
  for (const link of parseWikiLinks(body)) {
    const key = normalizeTitle(link.target);
    if (!seen.has(key)) seen.set(key, link.target);
  }
  return [...seen.values()];
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

/** Inline #tags in the body (code ignored, headings like "# Title" ignored). */
export function parseInlineTags(body: string): string[] {
  const masked = maskCode(body).replace(WIKILINK_RE, (m) => " ".repeat(m.length));
  const tags = new Set<string>();
  for (const m of masked.matchAll(TAG_RE)) {
    const tag = normalizeTag(m[2] ?? "");
    if (tag && !/^\d+$/.test(tag)) tags.add(tag);
  }
  return [...tags];
}

export function mergeTags(...lists: readonly (readonly string[])[]): string[] {
  const out = new Set<string>();
  for (const list of lists) for (const t of list) {
    const n = normalizeTag(t);
    if (n) out.add(n);
  }
  return [...out].sort();
}

/** Rename every [[old]] / [[old|x]] / [[old#h]] reference to newTitle (case-insensitive). */
export function renameWikiLinks(body: string, oldTitle: string, newTitle: string): string {
  const key = normalizeTitle(oldTitle);
  let out = "";
  let last = 0;
  for (const link of parseWikiLinks(body)) {
    if (normalizeTitle(link.target) !== key) continue;
    out += body.slice(last, link.start);
    out += `[[${newTitle}${link.heading ? `#${link.heading}` : ""}${link.label ? `|${link.label}` : ""}]]`;
    last = link.end;
  }
  return last === 0 ? body : out + body.slice(last);
}

/** Markdown -> plain text for excerpts/snippets (lossy, fast). */
export function markdownToText(body: string): string {
  return body
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(WIKILINK_RE, (_m, target: string, _h: string | undefined, label: string | undefined) => (label ?? target).trim())
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(body: string, max = 200): string {
  const text = markdownToText(body);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
