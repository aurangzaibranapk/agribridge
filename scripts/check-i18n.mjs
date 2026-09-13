#!/usr/bin/env node
/**
 * Tarjume ki chaabiyon ki jaanch — do sawal, dono khamosh kharabiyan.
 *
 * 1. EK CHAABI DO JAGAH. Saari dictionaries ek hi object mein girti
 *    hain (translations.ts), is liye baad wali pehli ko kha jati hai.
 *    Nateeja ye ke ek safhe par KISI AUR safhe ka unwan likha aata hai
 *    -- aur ye kabhi ghalti ki tarah nazar nahi aata, sirf ajeeb lagta
 *    hai. 5 September ko malik ne aisi ek misal pakRi: Machinery ki
 *    "Advance Tasdeeq" par "AgriBridge Academy" likha aa raha tha.
 *    Us waqt aisi 20 jagah thin.
 *
 * 2. CHAABI HAI HI NAHI. t("kuch_bhi") likh dene par safha girta nahi,
 *    bas chaabi ka apna naam nazar aane lagta hai.
 *
 * Chalane ka tareeqa:  node scripts/check-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DICT_DIR = "src/lib/i18n/dict";
const SRC = "src";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const keyOwners = new Map();
const duplicates = [];
for (const f of readdirSync(DICT_DIR).filter((n) => n.endsWith(".ts"))) {
  for (const line of readFileSync(join(DICT_DIR, f), "utf8").split("\n")) {
    const m = /^ {2}([a-z][a-zA-Z_0-9]*): \{/.exec(line);
    if (!m) continue;
    const key = m[1];
    if (keyOwners.has(key)) duplicates.push(`${key}: ${keyOwners.get(key)} aur ${f}`);
    else keyOwners.set(key, f);
  }
}

const missing = new Map();
for (const f of walk(SRC)) {
  if (f.includes("i18n")) continue;
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?<![A-Za-z0-9_$.])t\(\s*"([a-z][a-zA-Z_0-9]*)"/g)) {
    if (!keyOwners.has(m[1])) {
      if (!missing.has(m[1])) missing.set(m[1], []);
      missing.get(m[1]).push(f);
    }
  }
}

let bura = false;
if (duplicates.length) {
  bura = true;
  console.error(`\nEK CHAABI DO JAGAH (${duplicates.length}) — baad wali pehli ko kha jayegi:`);
  for (const d of duplicates) console.error("  " + d);
}
if (missing.size) {
  bura = true;
  console.error(`\nCHAABI MAUJOOD NAHI (${missing.size}) — safhe par chaabi ka naam likha aayega:`);
  for (const [k, files] of missing) console.error(`  ${k}  (${files[0]})`);
}
if (!bura) console.log(`Theek hai: ${keyOwners.size} chaabiyan, koi takraao nahi, koi gum nahi.`);
process.exit(bura ? 1 : 0);
