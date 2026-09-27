"use client";

/**
 * CONTRACT (owned by the graph lane): compact local graph around one note.
 * Props are fixed; the implementation replaces this placeholder.
 */
export type LocalGraphProps = { noteId: string; depth?: 1 | 2 | 3; height?: number };

export function LocalGraph({ height = 260 }: LocalGraphProps) {
  return <div style={{ height }} aria-hidden />;
}
