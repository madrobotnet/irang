#!/usr/bin/env node
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const argon2 = createRequire(import.meta.url)("argon2");
const rl = createInterface({ input, output });
const password = await rl.question("Password (input is visible; do not paste production secrets into chat): ");
rl.close();
if (!password) {
  console.error("empty password");
  process.exit(1);
}
const hash = await argon2.hash(password, { type: argon2.argon2id });
process.stdout.write(`${hash}\n`);
