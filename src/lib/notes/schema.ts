import { z } from "zod";

export const RESTORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const noteIdSchema = z.uuid().brand("NoteId");
export type NoteId = z.infer<typeof noteIdSchema>;

export function parseNoteId(value: string): NoteId | undefined {
  return noteIdSchema.safeParse(value).data;
}

const noteSchema = z.object({
  id: noteIdSchema,
  title: z.string(),
  body: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
}).readonly();
export type Note = z.infer<typeof noteSchema>;

export function parseNoteRow(row: unknown): Note {
  return noteSchema.parse(row);
}

const createNoteBodySchema = z.object({
  title: z.string().min(1),
  body: z.string(),
}).readonly();
export type CreateNoteInput = z.infer<typeof createNoteBodySchema>;

export function parseCreateNoteInput(value: unknown): CreateNoteInput | undefined {
  return createNoteBodySchema.safeParse(value).data;
}

const updateNoteBodySchema = z.object({
  title: z.string().min(1),
  body: z.string(),
}).readonly();
export type UpdateNoteInput = z.infer<typeof updateNoteBodySchema>;

export function parseUpdateNoteInput(value: unknown): UpdateNoteInput | undefined {
  return updateNoteBodySchema.safeParse(value).data;
}

const deletedAtRowSchema = z.object({ deletedAt: z.date().nullable() }).readonly();

export function parseDeletedAtRow(row: unknown): Date | null {
  return deletedAtRowSchema.parse(row).deletedAt;
}
