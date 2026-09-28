import { z } from "zod";
import { ApiError, json, parseJson, withApi } from "@/server/http";
import { getOrCreateDaily } from "@/server/notes/service";

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict();
function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export const POST = withApi(async (request) => {
  const { date = new Date().toISOString().slice(0, 10) } = await parseJson(request, Body);
  if (!validDate(date)) throw new ApiError("validation", "올바른 날짜를 입력해 주세요.");
  return json({ note: await getOrCreateDaily(date) });
});
