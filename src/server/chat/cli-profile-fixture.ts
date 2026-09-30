// Real subprocess fixture for the profile credential file contract; no OAuth/network calls.
import { once } from "node:events";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import { z } from "zod";

let stdin = "";
for await (const chunk of process.stdin) stdin += String(chunk);
const input = z.object({ question: z.string() }).parse(JSON.parse(stdin));
const command = z.object({
  access: z.string(), refresh: z.string(), next: z.string(),
  mode: z.enum(["success", "fail", "corrupt", "abort"]).default("success"),
  port: z.number().optional(),
}).parse(JSON.parse(input.question));
const home = process.env.GEMINI_CLI_HOME;
if (!home) throw new Error("Missing isolated home");
const file = path.join(home, ".gemini/oauth_creds.json");
const tokens = z.object({ access_token: z.string(), refresh_token: z.string(), expiry_date: z.number() }).parse(JSON.parse(await readFile(file, "utf8")));
if (tokens.access_token !== command.access || tokens.refresh_token !== command.refresh) throw new Error("Wrong profile credentials");
if (((await stat(file)).mode & 0o777) !== 0o600) throw new Error("Unsafe credential permissions");
if (process.env.GOOGLE_API_KEY || process.env.DATABASE_URL) throw new Error("Leaked environment");
if (command.port !== undefined) {
  const socket = createConnection({ host: "127.0.0.1", port: command.port });
  const connected = once(socket, "connect", { signal: AbortSignal.timeout(3000) });
  const release = once(socket, "data", { signal: AbortSignal.timeout(3000) });
  await connected;
  socket.write("ready");
  await release;
  socket.end();
}
const emit = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`);
emit({ type: "init", session_id: "fixture", model: "fixture" });
await writeFile(file, command.mode === "corrupt" ? "invalid" : JSON.stringify({
  access_token: command.next, expiry_date: 4_000_000_000_000, token_type: "Bearer",
  // The official library may omit refresh_token in a tokens event.
}), { mode: 0o600 });
emit({ type: "message", role: "assistant", content: path.dirname(home), delta: true });
if (command.mode === "abort") {
  (await import("node:net")).createServer().listen(0, "127.0.0.1");
} else if (command.mode === "fail") {
  emit({ type: "result", status: "error", error: { message: "fixture-error" } });
} else {
  emit({ type: "result", status: "success" });
}
