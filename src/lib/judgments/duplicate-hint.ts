import type { DuplicateHint } from "@/domain/judgments/types";

/**
 * UI `duplicateHint` boolean — derived from Rex wire (`DuplicateHint | null`).
 * True when Jev selected a concrete related note (not `none`).
 */
export function wireDuplicateHintToBoolean(duplicateHint: DuplicateHint | null): boolean {
  return duplicateHint?.relatedNoteId != null;
}
