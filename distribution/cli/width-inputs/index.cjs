// Independently implemented from Unicode 6.0.0 property data and the public API.
// New code: project MIT license in licenses/Project-MIT.txt.
// Unicode-derived ranges: original data headers and licenses/Unicode.txt.
const ranges = JSON.parse(process.getBuiltinModule("fs").readFileSync(`${__dirname}/ranges.json`, "utf8"));
const labels = ["N", "F", "H", "W", "Na", "A"];

function eastAsianWidth(character) {
  const point = character.codePointAt(0);
  if (point === undefined) return "N";
  let low = 0;
  let high = ranges.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (point > ranges[middle][1]) low = middle + 1;
    else high = middle;
  }
  return labels[ranges[low][2]];
}

function characterLength(character) {
  const width = eastAsianWidth(character);
  return width === "F" || width === "W" || width === "A" ? 2 : 1;
}

function tokens(text) {
  return [...text].filter(character => {
    const point = character.codePointAt(0);
    return point < 0xd800 || point > 0xdfff;
  });
}

function length(text) {
  return tokens(text).reduce((total, character) => total + characterLength(character), 0);
}

function slice(text, start, end) {
  start = start || 0;
  end = end || 1;
  const total = length(text);
  if (start < 0) start += total;
  if (end < 0) end += total;
  let used = 0;
  let result = "";
  for (const character of tokens(text)) {
    used += characterLength(character);
    if (used <= start) continue;
    if (used > end) break;
    result += character;
  }
  return result;
}

module.exports = { eastAsianWidth, characterLength, length, slice };
