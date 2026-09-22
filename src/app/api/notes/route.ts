import { handleCreateNote, handleListNotes } from "@/server/notes/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleListNotes(request);
}

export async function POST(request: Request) {
  return handleCreateNote(request);
}
