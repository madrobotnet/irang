"use client";

import { GraphExplorer } from "./GraphExplorer";

export type LocalGraphProps = { noteId: string; depth?: 1 | 2 | 3; height?: number };

export function LocalGraph({ noteId, depth = 1, height = 260 }: LocalGraphProps) {
  return <GraphExplorer key={noteId} noteId={noteId} depth={depth} height={height} compact />;
}
