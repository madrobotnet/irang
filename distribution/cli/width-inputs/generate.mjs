import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const out = "/home/ubuntu/project/second-brain/.omo/evidence/packaging-resume-20261001/repair/eastasianwidth-licensed";
const { values: args } = parseArgs({ options: { input: { type: "string" } } });
const bytes = await readFile(args.input ?? resolve(out, "sources/EastAsianWidth-6.0.0.txt"));
assert.equal(createHash("sha256").update(bytes).digest("hex"), "e947a0ea387e62c0797600406055703d859236113cd7b82c96625141a8294592");
const source = bytes.toString("utf8");
const labels = ["N", "F", "H", "W", "Na", "A"];
const values = new Uint8Array(0x110000);
const defaultWideRanges = [];
const header = source.slice(0, source.indexOf("\n0000;"));
for (const match of header.matchAll(/U\+([0-9A-F]+)\.\.U\+([0-9A-F]+)/g)) {
  const start = Number.parseInt(match[1], 16);
  const end = Number.parseInt(match[2], 16);
  values.fill(labels.indexOf("W"), start, end + 1);
  defaultWideRanges.push([start, end]);
}
let explicitRecords = 0;
const seen = new Uint8Array(values.length);
let repeatedPoints = 0;
for (const line of source.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const match = /^([0-9A-F]+)(?:\.\.([0-9A-F]+))?;([A-Za-z]+)\s*(?:#.*)?$/.exec(line);
  assert(match, `Invalid property record ${line}`);
  const start = Number.parseInt(match[1], 16);
  const end = Number.parseInt(match[2] ?? match[1], 16);
  const value = labels.indexOf(match[3]);
  assert(value >= 0 && end >= start && end < values.length, `Invalid range ${line}`);
  for (let point = start; point <= end; point++) {
    if (seen[point]) {
      assert.equal(values[point], value, `Conflicting property ${point.toString(16)} in ${line}`);
      repeatedPoints++;
    } else {
      values[point] = value;
      seen[point] = 1;
    }
  }
  explicitRecords++;
}
const ranges = [];
let begin = 0;
for (let point = 1; point <= values.length; point++) {
  if (point === values.length || values[point] !== values[begin]) {
    ranges.push([begin, point - 1, values[begin]]);
    begin = point;
  }
}
await writeFile(resolve(out, "ranges.json"), `${JSON.stringify(ranges)}\n`);
await writeFile(resolve(out, "generation.json"), `${JSON.stringify({
  version: "Unicode 6.0.0",
  inputSha256: createHash("sha256").update(bytes).digest("hex"),
  explicitRecords,
  repeatedPoints,
  defaultWideRanges,
  generatedRanges: ranges.length,
  labels,
  sourceCopyright: "Copyright (c) 1991-2010 Unicode, Inc.",
  sourceLicenseReference: "http://www.unicode.org/terms_of_use.html",
}, null, 2)}\n`);
console.log(JSON.stringify({ status: "GENERATED", explicitRecords, ranges: ranges.length }));
