import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Mutate only an owned image/source staging tree, never the historical cache.
if (!process.versions.bun) throw new Error("Run this replacement with Bun");
const { values } = parseArgs({
  options: {
    root: { type: "string" },
    materials: { type: "string" },
    out: { type: "string" },
  },
});
if (!values.root || !values.materials || !values.out) {
  throw new Error("Usage: bun scripts/apply-cli-replacement.mjs --root <owned-staging-tree> --materials <prepared-replacement-directory> --out <fresh-receipt-directory>");
}
const root = await realpath(values.root);
const materials = await realpath(values.materials);
const out = resolve(await realpath(dirname(resolve(values.out))), basename(values.out));
const inside = (base, path) => {
  const delta = relative(base, path);
  return delta === "" || (delta !== ".." && !delta.startsWith(`..${sep}`) && !delta.startsWith(sep));
};
if (inside(root, materials) || inside(materials, root) || inside(root, out) || inside(out, root) ||
    inside(materials, out) || inside(out, materials)) {
  throw new Error("Staging, materials and receipt paths must not overlap");
}
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const recipeBytes = await readFile(fileURLToPath(new URL("../distribution/cli/eastasianwidth-replacement.json", import.meta.url)));
const recipe = JSON.parse(recipeBytes);
const manifestBytes = await readFile(resolve(materials, "manifest.json"));
const manifest = JSON.parse(manifestBytes);
const replacement = manifest.replacement;
if (!replacement) throw new Error("Missing prepared replacement");
const record = manifest.sources.find(source => source.destination === replacement.sourceArchive);
if (!record || record.name !== recipe.package.name || record.version !== recipe.package.version) {
  throw new Error("Replacement source identity mismatch");
}
const archivePath = await realpath(resolve(materials, record.destination));
if (!inside(materials, archivePath)) throw new Error("External replacement archive");
const archiveBytes = await readFile(archivePath);
if (hash(archiveBytes) !== record.sha256 || archiveBytes.length !== record.bytes) {
  throw new Error("Replacement archive integrity mismatch");
}
const archive = await new Bun.Archive(archiveBytes).files();
const expectedNames = [
  ...recipe.files.map(file => file.path), "package.json", "REBUILD.md", "REPLACEMENT.json",
].sort();
if (JSON.stringify([...archive.keys()].sort()) !== JSON.stringify(expectedNames)) {
  throw new Error("Replacement archive member set mismatch");
}
const files = new Map();
const members = [];
for (const [path, member] of archive) {
  const bytes = Buffer.from(await member.arrayBuffer());
  const declared = replacement.members.find(file => file.path === path);
  if (!declared || declared.sha256 !== hash(bytes) || declared.bytes !== bytes.length) {
    throw new Error(`Replacement member integrity mismatch: ${path}`);
  }
  files.set(path, bytes);
  members.push({ path, bytes: bytes.length, sha256: hash(bytes) });
}
for (const input of recipe.files) {
  if (input.path === "generate.mjs") continue;
  if (hash(files.get(input.path)) !== input.sha256) {
    throw new Error(`Replacement pinned input mismatch: ${input.path}`);
  }
}
const { from, to } = recipe.generatorAdaptation;
const generator = files.get("generate.mjs").toString();
if (generator.split(to).length !== 2 || hash(Buffer.from(generator.replace(to, from))) !== recipe.files.find(file => file.path === "generate.mjs").sha256) {
  throw new Error("Replacement generator adaptation mismatch");
}
if (!files.get("REPLACEMENT.json").equals(recipeBytes) ||
    files.get("package.json").toString() !== `${JSON.stringify(recipe.package, null, 2)}\n`) {
  throw new Error("Replacement package/recipe identity mismatch");
}
const targets = new Map();
for await (const path of new Bun.Glob("**/eastasianwidth*/package.json").scan({ cwd: root, onlyFiles: true, followSymlinks: true })) {
  const metadataPath = await realpath(resolve(root, path));
  if (!inside(root, metadataPath)) throw new Error(`External module link: ${path}`);
  const metadataBytes = await readFile(metadataPath);
  const metadata = JSON.parse(metadataBytes);
  if (metadata.name !== recipe.original.name) continue;
  if (metadata.version !== recipe.original.version) throw new Error(`Unexpected original module version: ${path}`);
  const target = dirname(metadataPath);
  const implementationPath = await realpath(resolve(target, "eastasianwidth.js"));
  if (!inside(target, implementationPath)) throw new Error(`External implementation link: ${path}`);
  if (hash(await readFile(implementationPath)) !== recipe.original.implementationSHA256) {
    throw new Error(`Original implementation mismatch: ${path}`);
  }
  targets.set(target, { path: relative(root, target), originalMetadataSHA256: hash(metadataBytes) });
}
if (!targets.size) throw new Error("No original eastasianwidth modules found in staging tree");
// All byte and identity checks finish before either the receipt or targets change.
await mkdir(out);
for (const target of targets.keys()) {
  await rm(target, { recursive: true });
  await mkdir(target);
  for (const [path, bytes] of files) {
    const destination = resolve(target, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes, { flag: "wx" });
  }
}
const receipt = {
  schemaVersion: 1,
  root,
  materialsManifestSHA256: hash(manifestBytes),
  sourceArchiveSHA256: hash(archiveBytes),
  replacementPackage: recipe.package,
  originalImplementationSHA256: recipe.original.implementationSHA256,
  replacements: [...targets.values()],
  members,
  originalPermissionCleared: false,
  nativeProofCleared: false,
  finalImageVerified: false,
  releaseApproved: false,
};
await writeFile(resolve(out, "manifest.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ status: "STAGING_REPLACED_NOT_RELEASE_APPROVAL", replacements: targets.size, sourceArchiveSHA256: receipt.sourceArchiveSHA256 }));
