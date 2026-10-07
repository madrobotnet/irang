/** UTF-8 bytes upper-bound byte-fallback tokenizer tokens; reserve ample prompt space. */
export const PASSAGE_BYTE_LIMIT = 512;
export type Passage = {
  readonly ordinal: number;
  readonly heading: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly content: string;
};

export function chunkMarkdown(body: string): Passage[] {
  const chunks: Passage[] = [];
  let heading = "";
  let fence: string | undefined;
  let content = "";
  let bytes = 0;
  let hasBody = false;
  let startLine = 1;
  let endLine = 1;
  const flush = (skipHeadingOnly = false) => {
    if (content.trim() && (!skipHeadingOnly || hasBody)) chunks.push({ ordinal: chunks.length, heading, startLine, endLine, content: content.trim() });
    content = "";
    bytes = 0;
    hasBody = false;
  };
  for (const [index, line] of body.split("\n").entries()) {
    const lineNumber = index + 1;
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];
    const nextHeading = !fence ? line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)?.[1] : undefined;
    if (nextHeading) {
      flush(true);
      heading = nextHeading;
    }
    if (marker) {
      if (!fence) fence = marker[0];
      else if (marker[0] === fence) fence = undefined;
    }
    // Split even huge unbroken Korean paragraphs/code lines without breaking code points.
    for (const char of `${line}\n`) {
      const size = Buffer.byteLength(char, "utf8");
      if (bytes + size > PASSAGE_BYTE_LIMIT) flush();
      if (!content) startLine = lineNumber;
      content += char;
      bytes += size;
      endLine = lineNumber;
      if (!nextHeading && line.trim()) hasBody = true;
    }
    if (!fence && !line.trim() && hasBody) flush();
  }
  flush();
  return chunks;
}
