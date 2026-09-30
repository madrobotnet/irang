export type ExportNote = {
  readonly id: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  readonly createdAt: string; // ISO
  readonly updatedAt: string; // ISO
  readonly dailyDate: string | null; // YYYY-MM-DD
  readonly sourceUrl: string | null;
  readonly pinned: boolean;
  readonly archived: boolean;
  readonly body: string;
};

/** UTF-8 budget for one name before the collision suffix and extension (most file systems allow 255). */
const NAME_BYTES = 150;
// Reserved or unsafe on Windows, macOS or Linux, plus every control character.
const ILLEGAL = /[<>:"/\\|?*\p{Cc}]/gu;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i;
const encoder = new TextEncoder();
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function truncateUtf8(value: string, maxBytes: number): string {
  let bytes = 0;
  let result = "";
  for (const { segment } of graphemes.segment(value)) {
    bytes += encoder.encode(segment).length;
    if (bytes > maxBytes) break;
    result += segment;
  }
  return result;
}

/** A cross-platform file name stem (no extension) that keeps Korean and other Unicode text. */
export function safeFileName(raw: string, fallback: string): string {
  const cleaned = raw.normalize("NFC").replace(ILLEGAL, "-").replace(/\s+/g, " ").replace(/^[\s.]+/, "");
  const name = truncateUtf8(cleaned, NAME_BYTES).replace(/[\s.]+$/, "");
  if (!name) return fallback;
  return WINDOWS_DEVICE.test(name) ? name.replace(/^[^.]*/, (device) => `${device}_`) : name;
}

/** Split `photo.final.PNG` into a sanitized stem and a lowercase `.png` extension. */
export function safeAttachmentName(filename: string): { stem: string; extension: string } {
  const match = /^(.*?)(\.[A-Za-z0-9]{1,10})$/.exec(filename.normalize("NFC"));
  const stem = match ? match[1]! : filename;
  return { stem: safeFileName(stem, "attachment"), extension: match ? match[2]!.toLowerCase() : "" };
}

/**
 * Hand out unique names within one directory: `a.md`, `a-2.md`, `a-3.md`...
 * Comparison ignores case so the archive also unpacks on case-insensitive file systems.
 */
export function createNameAllocator(): (stem: string, extension: string) => string {
  const used = new Set<string>();
  return (stem, extension) => {
    for (let suffix = 1; ; suffix += 1) {
      const candidate = suffix === 1 ? `${stem}${extension}` : `${stem}-${suffix}${extension}`;
      const key = candidate.toLowerCase();
      if (!used.has(key)) {
        used.add(key);
        return candidate;
      }
    }
  };
}

/** Relative link from notes/ to attachments/<fileName>, escaping what would end a Markdown destination. */
export function attachmentHref(fileName: string): string {
  const escaped = fileName.replace(/[%\s()<>'"#[\]]/gu, (char) =>
    Array.from(encoder.encode(char), (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join(""));
  return `../attachments/${escaped}`;
}

// Inline links/images, reference definitions and HTML src/href attributes that point at /api/attachments/<id>.
const ATTACHMENT_LINK =
  /(\]\(\s*<?|^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*<?|\b(?:src|href)=["'])\/api\/attachments\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![0-9a-z-])/gim;

/** Rewrite links to exported attachments; ids without an entry in `hrefs` keep their original link. */
export function rewriteAttachmentLinks(body: string, hrefs: ReadonlyMap<string, string>): string {
  return body.replace(ATTACHMENT_LINK, (match, prefix: string, id: string) => {
    const href = hrefs.get(id.toLowerCase());
    return href === undefined ? match : `${prefix}${href}`;
  });
}

/** A YAML double-quoted scalar; JSON escapes plus the characters YAML treats as breaks or non-printable. */
function quote(value: string): string {
  return JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029\ufeff\ufffe\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
const list = (values: readonly string[]): string =>
  values.length === 0 ? " []" : values.map((value) => `\n  - ${quote(value)}`).join("");
const nullable = (value: string | null): string => (value === null ? "null" : quote(value));

export function frontMatter(note: ExportNote): string {
  return [
    "---",
    `id: ${quote(note.id)}`,
    `title: ${quote(note.title)}`,
    `aliases:${list(note.aliases)}`,
    `tags:${list(note.tags)}`,
    `created: ${quote(note.createdAt)}`,
    `updated: ${quote(note.updatedAt)}`,
    `daily_date: ${nullable(note.dailyDate)}`,
    `source_url: ${nullable(note.sourceUrl)}`,
    `pinned: ${note.pinned}`,
    `archived: ${note.archived}`,
    "---",
    "",
  ].join("\n");
}

/** Front matter followed by the body, verbatim apart from rewritten attachment links. */
export function noteMarkdown(note: ExportNote, attachmentHrefs: ReadonlyMap<string, string>): string {
  return frontMatter(note) + rewriteAttachmentLinks(note.body, attachmentHrefs);
}
