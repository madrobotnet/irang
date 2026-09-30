import { z } from "zod";
import { localizedIssue } from "@/lib/i18n/validation";
import { listDailyMonth } from "@/server/daily/calendar";
import { dailyCopy } from "@/server/daily/copy";
import { json, withApi } from "@/server/http";

export const runtime = "nodejs";

const MonthQuery = z.object({
  month: z.string().regex(/^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/, { ...localizedIssue(dailyCopy.badMonth) }),
}).strict();

export const GET = withApi(async (request) => {
  const { month } = MonthQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  return json(await listDailyMonth(month));
});
