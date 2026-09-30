// Real subprocess fixture. It never calls an official CLI or network model.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, readdir, realpath } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import { z } from "zod";

const argument = (name: string): string => process.argv[process.argv.indexOf(name) + 1] ?? "";
const emit = (value: unknown): void => { process.stdout.write(`${JSON.stringify(value)}\n`); };
const delta = (content: string): void => emit({ type: "message", role: "assistant", delta: true, content });

if (process.argv[2] === "descendant") {
  const socket = createConnection({ port: Number(process.argv[3]), host: "127.0.0.1" });
  await once(socket, "connect");
  socket.write("descendant-ready\n");
  process.send?.("ready");
  // The socket, not a timer, keeps this descendant alive until the group dies.
} else {
  let stdin = "";
  for await (const chunk of process.stdin) stdin += String(chunk);
  const input = z.object({
    question: z.string(),
    history: z.array(z.unknown()),
    sources: z.array(z.unknown()),
  }).parse(JSON.parse(stdin));
  const mode = argument("--model");
  if (mode !== "missing-init") emit({ type: "init", session_id: "fixture", model: mode });

  switch (mode) {
    case "success": {
      emit({ type: "message", role: "user", content: "never-forward-user-echo" });
      const first = Buffer.from(`${JSON.stringify({ type: "message", role: "assistant", delta: true, content: "한글" })}\r\n`);
      for (const byte of first) {
        await new Promise<void>((resolve, reject) => {
          process.stdout.write(Buffer.from([byte]), (error) => error ? reject(error) : resolve());
        });
      }
      delta(" response");
      emit({ type: "result", status: "success" });
      break;
    }
    case "inspect": {
      const home = process.env.HOME ?? "";
      const settings = process.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH ?? "";
      delta(JSON.stringify({
        argv: process.argv.slice(2),
        env: process.env,
        cwd: process.cwd(),
        cwdEntries: await readdir(process.cwd()),
        homeEntries: await readdir(home),
        configEntries: await readdir(path.join(home, ".gemini")),
        credential: await realpath(path.join(home, ".gemini/oauth_creds.json")),
        settings: JSON.parse(await readFile(settings, "utf8")),
        policy: await readFile(argument("--policy"), "utf8"),
        stdin,
      }));
      emit({ type: "result", status: "success" });
      break;
    }
    case "tree":
    case "tree-success": {
      const descendant = spawn(process.execPath, [import.meta.filename, "descendant", input.question], {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
      await once(descendant, "message");
      delta(JSON.stringify({ pid: process.pid, descendant: descendant.pid, root: path.dirname(process.cwd()) }));
      if (mode === "tree-success") {
        emit({ type: "result", status: "success" });
        process.exit(0);
      }
      break;
    }
    case "hang":
      // An open server keeps the process alive; tests exercise a real deadline.
      (await import("node:net")).createServer().listen(0, "127.0.0.1");
      break;
    case "malformed":
      process.stdout.write("not-json SECRET\n");
      break;
    case "invalid-utf8":
      process.stdout.write(Buffer.from([0xff, 0x0a]));
      break;
    case "wrong-delta":
      emit({ type: "message", role: "assistant", content: 7, delta: true });
      break;
    case "non-delta":
      emit({ type: "message", role: "assistant", content: "SECRET" });
      break;
    case "tool":
      emit({ type: "tool_use", tool_name: "read_file", parameters: { path: "/etc/passwd" } });
      break;
    case "error":
      emit({ type: "error", severity: "warning", message: "SECRET" });
      break;
    case "terminal-error":
      delta("partial");
      emit({ type: "result", status: "error", error: { message: "SECRET" } });
      break;
    case "nonzero":
      delta("partial");
      process.stderr.write("SECRET stderr");
      emit({ type: "result", status: "success" });
      process.exitCode = 9;
      break;
    case "truncated":
      delta("partial");
      process.stdout.write('{"type":"result","status":"succ');
      break;
    case "no-terminal":
    case "missing-init":
      delta("partial");
      break;
    case "empty":
      emit({ type: "result", status: "success" });
      break;
    case "after-terminal":
      delta("partial");
      emit({ type: "result", status: "success" });
      delta("not allowed");
      break;
    case "no-final-newline":
      delta("partial");
      process.stdout.write('{"type":"result","status":"success"}');
      break;
    case "stdout-limit":
      process.stdout.write("x".repeat(8192));
      break;
    case "line-limit":
      process.stdout.write("x".repeat(1024 * 1024 + 1));
      break;
    case "stderr-limit":
      process.stderr.write("SECRET".repeat(2048));
      delta("partial");
      emit({ type: "result", status: "success" });
      break;
    default:
      process.exitCode = 2;
  }
}
