import { exportResponse } from "@/server/export/service";
import { withApi } from "@/server/http";

export const runtime = "nodejs";

export const GET = withApi(async () => exportResponse());
