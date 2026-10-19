import type { DemandCategory } from "./categories";

/**
 * Digital Munshi v1 — sirf qaidon par chalta hai, koi bahar ki AI nahi.
 * "mujhe 20 boriyan urea chahiye" -> { qty: 20, unit: "bag", productName: "Urea" }
 * "3 acre wheat ke liye DAP"      -> { productName: "DAP", acres: 3, crop: "wheat", qty: null }
 */
export interface MunshiProduct { id: string; name: string }
export interface MunshiParse {
  productId: string | null;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  category: DemandCategory | null;
  acres: number | null;
  crop: string | null;
  missing: ("product" | "quantity" | "unit")[];
}

const URDU_DIGITS: Record<string, string> = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9", "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const NUM_WORDS: Record<string, number> = {
  ek: 1, aik: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chay: 6, chhe: 6, saat: 7, aath: 8, ath: 8, nau: 9, das: 10, dus: 10,
  gyara: 11, barah: 12, baara: 12, pandrah: 15, bees: 20, pachees: 25, tees: 30, chalees: 40, pachas: 50, pachaas: 50, sau: 100,
  "ایک": 1, "دو": 2, "تین": 3, "چار": 4, "پانچ": 5, "چھ": 6, "سات": 7, "آٹھ": 8, "نو": 9, "دس": 10, "بیس": 20, "تیس": 30, "پچاس": 50, "سو": 100,
};
const UNIT_WORDS: [RegExp, string][] = [
  [/^(bori|boriyan|boriyaan|borian|bory|bag|bags|thaila|thaile|بوری|بوریاں|بوریان|تھیلا|تھیلے)$/, "bag"],
  [/^(kg|kilo|kilos|kilogram|کلو)$/, "kg"],
  [/^(maund|mann|man|من)$/, "maund"],
  [/^(liter|litre|liters|litres|ltr|لیٹر)$/, "liter"],
  [/^(packet|packets|paket|pack|پیکٹ)$/, "packet"],
  [/^(bottle|bottles|botal|بوتل)$/, "bottle"],
];
const ACRE = /^(acre|acres|ekar|aikar|ایکڑ)$/;
const CATEGORY_WORDS: [RegExp, DemandCategory, string?][] = [
  [/^(urea|یوریا)$/, "fertilizer", "Urea"],
  [/^(dap|ڈی[\s]?اے[\s]?پی)$/, "fertilizer", "DAP"],
  [/^(npk|nitrophos|sop|mop|potash|can|khaad|khad|کھاد)$/, "fertilizer"],
  [/^(wanda|wanra|ونڈا)$/, "wanda", "Wanda"],
  [/^(khal|khul|کھل)$/, "khal", "Khal"],
  [/^(chowker|chokar|choker|چوکر)$/, "chowker", "Chowker"],
  [/^(moomni|momni|مومنی)$/, "moomni", "Moomni"],
  [/^(beej|seed|seeds|بیج)$/, "seed"],
  [/^(spray|zehar|zahar|dawai|dawa|pesticide|سپرے|زہر|دوائی)$/, "pesticide"],
  [/^(zinc|boron|micronutrient|zink|زنک|بوران)$/, "micronutrient"],
  [/^(karyana|kiryana|sauda|ghee|gheo|cheeni|chini|daal|dal|chai|patti|sabun|surf|masala|atta|aata|کریانہ|گھی|چینی|دال|چائے|صابن|آٹا)$/, "karyana"],
];
const CROPS: Record<string, string> = { wheat: "wheat", gandum: "wheat", "گندم": "wheat", rice: "rice", chawal: "rice", dhan: "rice", munji: "rice", "چاول": "rice", maize: "maize", makai: "maize", "مکئی": "maize", cotton: "cotton", kapas: "cotton", "کپاس": "cotton", sugarcane: "sugarcane", gannay: "sugarcane", kamad: "sugarcane", "گنا": "sugarcane" };
const STOP = new Set(["mujhe", "mujhay", "muje", "hamein", "chahiye", "chaiye", "chahye", "chahiay", "ke", "ki", "ka", "liye", "liay", "lye", "or", "aur", "de", "do", "dein", "den", "please", "plz", "bhai", "ji", "ko", "se", "main", "mein", "mere", "meri", "hai", "hain", "مجھے", "چاہیے", "کے", "لیے", "لئے", "کی", "کا", "اور", "ہے"]);

function norm(s: string) {
  return s.replace(/[۰-۹٠-٩]/g, (c) => URDU_DIGITS[c] ?? c).toLowerCase().replace(/[،,.!?؟]/g, " ").replace(/\s+/g, " ").trim();
}
function toNum(tok: string): number | null {
  if (/^\d+(\.\d+)?$/.test(tok)) return Number(tok);
  return tok in NUM_WORDS ? NUM_WORDS[tok] : null;
}

export function parseMunshiCommand(input: string, products: MunshiProduct[] = []): MunshiParse {
  const text = norm(input);
  const toks = text.split(" ").filter(Boolean);
  let quantity: number | null = null, unit: string | null = null, acres: number | null = null, crop: string | null = null;
  let category: DemandCategory | null = null, productName: string | null = null, productId: string | null = null;
  const used = new Set<number>();

  for (let i = 0; i < toks.length; i++) {
    const n = toNum(toks[i]);
    // "do" ek number bhi hai aur "de do" bhi -- sirf tab number jab aage unit/acre ho.
    if (n === null) continue;
    const next = toks[i + 1] ?? "";
    if (ACRE.test(next)) { acres = n; used.add(i); used.add(i + 1); continue; }
    const u = UNIT_WORDS.find(([re]) => re.test(next));
    if (u) { quantity = n; unit = u[1]; used.add(i); used.add(i + 1); continue; }
    if (/^\d/.test(toks[i]) && quantity === null) { quantity = n; used.add(i); }
  }
  for (let i = 0; i < toks.length; i++) {
    if (used.has(i)) continue;
    const t = toks[i];
    if (CROPS[t] && !crop) { crop = CROPS[t]; used.add(i); continue; }
    if (!unit) { const u = UNIT_WORDS.find(([re]) => re.test(t)); if (u) { unit = u[1]; used.add(i); continue; } }
    const c = CATEGORY_WORDS.find(([re]) => re.test(t));
    if (c) { category = category ?? c[1]; if (c[2] && !productName) productName = c[2]; used.add(i); }
  }
  // Catalogue se milan: lamba naam pehle (e.g. "DAP Engro" se pehle "DAP" na pakre).
  const sorted = [...products].sort((a, b) => b.name.length - a.name.length);
  const hit = sorted.find((p) => {
    const pn = norm(p.name);
    return pn.length >= 3 && (text.includes(pn) || (productName && pn === norm(productName)));
  }) ?? (productName ? sorted.find((p) => norm(p.name).split(" ").includes(norm(productName!))) : undefined);
  if (hit) { productId = hit.id; productName = hit.name; }
  if (!productName) {
    const rest = toks.filter((t, i) => !used.has(i) && !STOP.has(t) && toNum(t) === null && t.length > 1);
    if (rest.length) productName = rest.slice(0, 3).join(" ").replace(/^\w/, (c) => c.toUpperCase());
  }
  if (quantity !== null && !unit) unit = "bag";
  const missing: MunshiParse["missing"] = [];
  if (!productName) missing.push("product");
  if (quantity === null) missing.push("quantity");
  if (!unit) missing.push("unit");
  return { productId, productName, quantity, unit, category, acres, crop, missing };
}

export function munshiQuestion(p: MunshiParse): string {
  if (p.missing.includes("product")) return "Kaun sa product chahiye? (misal: Urea, DAP, Wanda)";
  if (p.missing.includes("quantity")) return p.acres ? `${p.acres} acre ke liye kitni boriyan chahiye? Quantity likhein.` : "Kitni miqdar chahiye? Quantity likhein.";
  if (p.missing.includes("unit")) return "Unit chunein (bori, kg, liter...).";
  return "Sab theek hai? Neeche check kar ke 'Demand save karein' dabayein.";
}
