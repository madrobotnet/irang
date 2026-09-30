import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

// Offline build input only: never infer a license from the application's license.
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!["--root", "--out"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--") || options[args[i]]) {
    throw new Error("Usage: bun scripts/collect-image-licenses.mjs --root <installed-tree> --out <new-output-directory>");
  }
  options[args[i]] = args[i + 1];
}
if (!options["--root"] || !options["--out"]) {
  throw new Error("Both --root and --out are required");
}
const root = await realpath(resolve(options["--root"]));
const requestedOut = resolve(options["--out"]);
let ancestor = dirname(requestedOut);
const suffix = [basename(requestedOut)];
let out;
for (;;) {
  try {
    out = resolve(await realpath(ancestor), ...suffix);
    break;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    suffix.unshift(basename(ancestor));
    ancestor = dirname(ancestor);
  }
}
const inside = (parent, child) => {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
};
if (inside(root, out) || inside(out, root)) throw new Error("Input and output trees must not overlap");
if (!(await stat(root)).isDirectory()) throw new Error("--root must be a directory");
// Refuse stale output rather than leave unindexed texts from an earlier build.
await mkdir(dirname(out), { recursive: true });
await mkdir(out, { recursive: false });
await mkdir(resolve(out, "texts"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const slash = (path) => path.split(sep).join("/");
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const packages = [];
const unresolved = [];
const visited = new Set();
const errors = [];
const orphanTexts = [];
const textName = /^(?:licen[sc]e|copying|notice|ofl)(?:$|[._-])/i;

async function walk(path, owner) {
  let canonical;
  let entries;
  try {
    canonical = await realpath(path);
    if (visited.has(canonical)) return;
    visited.add(canonical);
    entries = (await readdir(canonical, { withFileTypes: true })).sort((a, b) => compare(a.name, b.name));
  } catch (error) {
    errors.push({ path: slash(relative(root, path)), error: error.message });
    return;
  }
  const sourcePath = slash(relative(root, path)) || ".";
  if (entries.some((entry) => entry.name === "package.json")) {
    try {
      const metadata = JSON.parse(await readFile(resolve(canonical, "package.json"), "utf8"));
      if (typeof metadata.name === "string" && typeof metadata.version === "string") {
        owner = {
          name: metadata.name, version: metadata.version, path: sourcePath,
          license: metadata.license ?? null, licenses: metadata.licenses ?? null,
          repository: metadata.repository ?? null, texts: [],
        };
        packages.push(owner);
      } else {
        unresolved.push({ path: sourcePath, reason: "package.json has no name/version identity" });
      }
    } catch (error) {
      errors.push({ path: `${sourcePath}/package.json`, error: error.message });
    }
  }
  for (const entry of entries) {
    const file = resolve(path, entry.name);
    try {
      const info = entry.isSymbolicLink() ? await stat(file) : entry;
      if (info.isDirectory()) {
        await walk(file, owner);
      } else if (info.isFile() && textName.test(entry.name)) {
        const bytes = await readFile(file);
        const source = slash(relative(root, file));
        const destination = `texts/${hash(source)}-${basename(file)}`;
        await writeFile(resolve(out, destination), bytes, { flag: "wx" });
        const text = { source, destination, sha256: hash(bytes), bytes: bytes.length };
        (owner ? owner.texts : orphanTexts).push(text);
      }
    } catch (error) {
      errors.push({ path: slash(relative(root, file)), error: error.message });
    }
  }
}
await walk(root, null);
packages.sort((a, b) => compare(a.path, b.path));
for (const pkg of packages) {
  const identity = { name: pkg.name, version: pkg.version, path: pkg.path };
  if (!pkg.license && !pkg.licenses) unresolved.push({ ...identity, reason: "No declared license metadata" });
  if (!pkg.texts.length) unresolved.push({ ...identity, reason: "No retained license/notice text; review upstream distribution requirements" });
  const declaration = JSON.stringify(pkg.license ?? pkg.licenses);
  if (!/^"(?:MIT|ISC|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|0BSD|CC0-1\.0|Unlicense)"$/.test(declaration)) {
    unresolved.push({ ...identity, reason: "License declaration requires review (unknown, compound, custom or potential source/redistribution obligations)", declaration: pkg.license ?? pkg.licenses });
  }
}
if (!packages.length) unresolved.push({ path: ".", reason: "No identified installed packages found" });
if (orphanTexts.length) unresolved.push({ path: ".", reason: "Texts without package identity require attribution review" });
const inventory = {
  schemaVersion: 1, sourceRoot: root, packages, orphanTexts,
  unresolved, errors,
  summary: { packages: packages.length, texts: packages.reduce((n, pkg) => n + pkg.texts.length, orphanTexts.length), unresolved: unresolved.length, errors: errors.length },
};
await writeFile(resolve(out, "inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
await writeFile(resolve(out, "unresolved.json"), `${JSON.stringify({ unresolved, errors }, null, 2)}\n`);
console.log(JSON.stringify({ output: out, ...inventory.summary }));
if (errors.length) process.exitCode = 1;
