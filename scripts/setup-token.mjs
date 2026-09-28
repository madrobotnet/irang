import { randomBytes } from "node:crypto";

// Run on the installation server; this is not a login password or an AI key.
console.log(`SETUP_TOKEN=${randomBytes(32).toString("hex")}`);
