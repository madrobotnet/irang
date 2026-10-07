import type { ExtraProps } from "react-markdown";
import type { SourcePassage } from "@/lib/types";

/** A location without a source version cannot safely point into a note. */
export function sourceNoteUrl(noteId: string, passage?: SourcePassage, updatedAt?: string): string {
  const path = `/notes/${encodeURIComponent(noteId)}`;
  if (!passage || !updatedAt) return path;
  return `${path}?${new URLSearchParams({ line: String(passage.startLine), at: updatedAt })}`;
}

export type SourceEvidence =
  | { readonly state: "none" | "invalid" | "stale" | "draft" | "checking" }
  | { readonly state: "ready"; readonly line: number; readonly updatedAt: string };

/** URL input is checked against the saved note, never against an unacknowledged draft. */
export function sourceEvidence(
  line: string | null,
  at: string | null,
  savedAt: string,
  hasDraft: boolean,
  checking: boolean,
): SourceEvidence {
  if (line === null) return { state: "none" };
  const parsedLine = Number(line);
  const timestamp = at ? Date.parse(at) : NaN;
  if (!/^[1-9]\d*$/.test(line) || !Number.isSafeInteger(parsedLine) || !Number.isFinite(timestamp)) return { state: "invalid" };
  if (checking) return { state: "checking" };
  if (timestamp !== Date.parse(savedAt)) return { state: "stale" };
  if (hasDraft) return { state: "draft" };
  return { state: "ready", line: parsedLine, updatedAt: savedAt };
}

export type SourceBlock = { readonly startLine: number; readonly endLine: number };

/** Positions survive wikilink expansion; heading text is not a unique source identity. */
export function sourceBlockAttributes(node: ExtraProps["node"]) {
  const position = node?.position;
  if (!position) return {};
  return {
    id: `source-line-${position.start.line}-${node.tagName}`,
    "data-source-start": position.start.line,
    "data-source-end": position.end.line,
    tabIndex: -1,
  };
}

/** Soft-wrapped/very long paragraphs and code point to their containing rendered block. */
export function sourceBlockForLine<T extends SourceBlock>(blocks: readonly T[], line: number, body: string): T | undefined {
  const containing = blocks.reduce<T | undefined>((best, block) => {
    if (line < block.startLine || line > block.endLine) return best;
    // On ties prefer the inner element, which follows its parent in document order.
    return !best || block.endLine - block.startLine <= best.endLine - best.startLine ? block : best;
  }, undefined);
  // A passage may begin on a blank separator; open the next block, not an unrelated previous one.
  return containing ?? (body.split("\n")[line - 1]?.trim() === "" ? blocks.find((block) => block.startLine > line) : undefined);
}
