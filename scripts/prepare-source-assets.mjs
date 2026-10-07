import { prepareAssets } from "../distribution/release/assets.mjs";

try {
  const args = process.argv.slice(2);
  const options = {};
  const allowed = ["materials", "seal", "out", "version", "revision", "platform", "limit"];
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].slice(2);
    if (!args[i].startsWith("--") || !allowed.includes(key) || options[key] ||
        !args[i + 1] || args[i + 1].startsWith("--")) throw Error(`Invalid argument: ${args[i]}`);
    options[key] = args[i + 1];
  }
  for (const key of allowed.filter(key => key !== "limit")) if (!options[key]) throw Error(`Required --${key}`);
  console.log(JSON.stringify(await prepareAssets(options)));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
