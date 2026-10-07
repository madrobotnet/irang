import { closeDb } from "@/server/db";
import { runSemanticIndexBatch } from "@/server/search/indexer";
import { indexStatus } from "@/server/search/passages";

try {
  let status = await indexStatus(true);
  while (status.state === "indexing") {
    const indexed = await runSemanticIndexBatch();
    status = await indexStatus(true);
    console.log(JSON.stringify({ indexedPassages: indexed, ...status }));
  }
  console.log(JSON.stringify(status));
  if (status.state !== "ready") process.exitCode = 1;
} finally {
  await closeDb();
}
