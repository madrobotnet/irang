import { getGraph, parseGraphQuery } from "@/server/graph";
import { json, withApi } from "@/server/http";

export const GET = withApi(async (request) => {
  const options = parseGraphQuery(new URL(request.url));
  return json(await getGraph(options));
});
