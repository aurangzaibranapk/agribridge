import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const perf = readFileSync(new URL("../src/lib/mobile/perf.ts", import.meta.url), "utf8");
const match = perf.match(/export const MOBILE_BUNDLE_BUDGET_BYTES = ([0-9_]+)/);
if (!match) {
  console.error("MOBILE_BUNDLE_BUDGET_BYTES perf.ts mein nahi mila.");
  process.exit(1);
}
const MOBILE_BUNDLE_BUDGET_BYTES = Number(match[1].replaceAll("_", ""));

const root = process.argv[2];
if (!root) {
  console.error("Usage: node scripts/check-mobile-bundle.mjs <export-dir>");
  process.exit(1);
}

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (name.endsWith(".js") || name.endsWith(".hbc")) files.push({ path, bytes: stat.size });
  }
}
walk(root);
if (files.length === 0) {
  console.error("Android bundle nahi mila.");
  process.exit(1);
}
files.sort((a, b) => b.bytes - a.bytes);
const largest = files[0];
console.log(`MOBILE_BUNDLE ${JSON.stringify({ bytes: largest.bytes, budget: MOBILE_BUNDLE_BUDGET_BYTES, file: largest.path })}`);
if (largest.bytes > MOBILE_BUNDLE_BUDGET_BYTES) {
  console.error(`Bundle ${largest.bytes} bytes, hadd ${MOBILE_BUNDLE_BUDGET_BYTES}.`);
  process.exit(1);
}
