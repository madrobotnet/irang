import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function NoteByIdPage({ params }: Params) {
  const { id } = await params;
  redirect(`/notes?note=${encodeURIComponent(id)}`);
}
