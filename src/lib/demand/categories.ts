export const DEMAND_CATEGORIES = ["wanda", "khal", "chowker", "moomni", "seed", "pesticide", "fertilizer", "micronutrient", "karyana", "other"] as const;
export type DemandCategory = (typeof DEMAND_CATEGORIES)[number];
export const DEMAND_CATEGORY_LABELS: Record<DemandCategory, { rm: string; ur: string }> = {
  wanda: { rm: "Wanda", ur: "ونڈا" },
  khal: { rm: "Khal", ur: "کھل" },
  chowker: { rm: "Chowker", ur: "چوکر" },
  moomni: { rm: "Moomni", ur: "مومنی" },
  seed: { rm: "Beej (Seed)", ur: "بیج" },
  pesticide: { rm: "Spray / Pesticide", ur: "زرعی دوا" },
  fertilizer: { rm: "Khaad (Fertilizer)", ur: "کھاد" },
  micronutrient: { rm: "Micronutrient", ur: "مائیکرو نیوٹرینٹ" },
  karyana: { rm: "Karyana (Grocery)", ur: "کریانہ" },
  other: { rm: "Other / Kuch aur", ur: "دیگر" },
};
export function isDemandCategory(v: unknown): v is DemandCategory {
  return typeof v === "string" && (DEMAND_CATEGORIES as readonly string[]).includes(v);
}

/* ---------- Farmer portal: qism (group) cards ---------- */
export const DEMAND_GROUPS = ["karyana", "fertilizer", "pesticide", "seed", "feed", "other"] as const;
export type DemandGroup = (typeof DEMAND_GROUPS)[number];
export type DemandUnit = "bag" | "kg" | "liter" | "ml" | "packet" | "bottle" | "piece" | "other";

export const UNIT_LABELS: Record<DemandUnit, string> = {
  bag: "Bori/bag", kg: "KG", liter: "Litre", ml: "ml", packet: "Packet", bottle: "Bottle", piece: "Piece", other: "Other",
};

export type DemandGroupInfo = {
  en: string; rm: string; ur: string; icon: string;
  /** Tailwind colour family for the card */
  tone: "amber" | "green" | "rose" | "violet" | "orange" | "sky";
  defaultUnit: DemandUnit;
  units: DemandUnit[];
  /** demand category saved when the farmer does not pick a type */
  defaultCategory: DemandCategory;
  placeholder: string;
};

export const DEMAND_GROUP_INFO: Record<DemandGroup, DemandGroupInfo> = {
  karyana: { en: "Grocery", rm: "Karyana / Sauda", ur: "کریانہ", icon: "🛒", tone: "amber", defaultUnit: "packet", units: ["packet", "kg", "piece", "liter", "other"], defaultCategory: "karyana", placeholder: "Misal: Ghee, cheeni, daal..." },
  fertilizer: { en: "Fertilizer", rm: "Khaad", ur: "کھاد", icon: "🌱", tone: "green", defaultUnit: "bag", units: ["bag", "kg", "packet", "other"], defaultCategory: "fertilizer", placeholder: "Misal: Urea, DAP, Zinc..." },
  pesticide: { en: "Pesticide", rm: "Spray / Zehar", ur: "زرعی دوا / سپرے", icon: "🧪", tone: "rose", defaultUnit: "bottle", units: ["bottle", "liter", "ml", "packet", "kg", "other"], defaultCategory: "pesticide", placeholder: "Misal: Confidor, Emamectin..." },
  seed: { en: "Seed", rm: "Beej", ur: "بیج", icon: "🌾", tone: "violet", defaultUnit: "bag", units: ["bag", "kg", "packet", "other"], defaultCategory: "seed", placeholder: "Misal: Gandum beej, makai..." },
  feed: { en: "Animal Feed", rm: "Wanda / Khal / Chokar", ur: "ونڈا / کھل", icon: "🐄", tone: "orange", defaultUnit: "bag", units: ["bag", "kg", "other"], defaultCategory: "wanda", placeholder: "Misal: Wanda, khal binola..." },
  other: { en: "Other", rm: "Kuch aur", ur: "دیگر", icon: "📦", tone: "sky", defaultUnit: "piece", units: ["piece", "kg", "packet", "liter", "other"], defaultCategory: "other", placeholder: "Product ka naam likhein" },
};

/** Wanda group ki types -- ye seedha demand category ban jati hain. */
export const FEED_TYPES: DemandCategory[] = ["wanda", "khal", "chowker", "moomni"];

export function isDemandGroup(v: unknown): v is DemandGroup {
  return typeof v === "string" && (DEMAND_GROUPS as readonly string[]).includes(v);
}

/**
 * Product ki ROOT category (naam + kind) se qism.
 * category_kind par bharosa nahi (Grocery sub-categories "agri" hain), is liye naam pehle.
 * "hidden" = farmer ko dikhana hi nahi (Raw Grain procurement).
 */
export function groupForCategory(rootName: string | null | undefined, rootKind?: string | null): DemandGroup | "hidden" {
  const n = (rootName ?? "").toLowerCase();
  if (!n) return "other";
  if (/raw grain|procurement/.test(n)) return "hidden";
  if (/grocery|karyana/.test(n)) return "karyana";
  if (/pesticide|spray|insecticide|herbicide|weedicide|fungicide/.test(n)) return "pesticide";
  if (/fertili[sz]er|khaad|micronutrient/.test(n)) return "fertilizer";
  if (/seed|beej/.test(n)) return "seed";
  if (/feed|wanda/.test(n)) return "feed";
  if ((rootKind ?? "").toLowerCase() === "karyana") return "karyana";
  return "other";
}

/** Saved demand category -> card group (purani demands bhi). */
export function groupOfDemandCategory(c: string | null | undefined): DemandGroup | null {
  switch (c) {
    case "wanda": case "khal": case "chowker": case "moomni": return "feed";
    case "fertilizer": case "micronutrient": return "fertilizer";
    case "pesticide": return "pesticide";
    case "seed": return "seed";
    case "karyana": return "karyana";
    case "other": return "other";
    default: return null;
  }
}

/** Group + (optional) product sub-category / feed type -> demand category to save. */
export function demandCategoryFor(group: DemandGroup, subName?: string | null, feedType?: string | null): DemandCategory {
  if (group === "feed") return feedType && FEED_TYPES.includes(feedType as DemandCategory) ? (feedType as DemandCategory) : "wanda";
  if (group === "fertilizer" && /micronutrient/i.test(subName ?? "")) return "micronutrient";
  return DEMAND_GROUP_INFO[group].defaultCategory;
}

/** Product master ki unit ("Bags (bags)", "Litre (ltr)") -> demand unit; samajh na aaye to group default. */
export function normalizeUnit(raw: string | null | undefined, group: DemandGroup): DemandUnit {
  const u = (raw ?? "").toLowerCase();
  if (/bag|bori/.test(u)) return "bag";
  if (/millil|\bml\b/.test(u)) return "ml";
  if (/kilo|\bkg\b/.test(u)) return "kg";
  if (/lit|ltr/.test(u)) return "liter";
  if (/bottle/.test(u)) return "bottle";
  if (/packet|pack/.test(u)) return "packet";
  if (/pcs|piece/.test(u)) return "piece";
  return DEMAND_GROUP_INFO[group].defaultUnit;
}

/** Product sub-category ke asaan labels (chips). */
const SUB_LABELS: [RegExp, string][] = [
  [/insecticide/i, "Keera maar · Insecticide"],
  [/herbicide|weedicide/i, "Jarri-booti maar · Herbicide"],
  [/fungicide/i, "Fungicide"],
  [/micronutrient/i, "Micronutrient · Zinc/Boron"],
  [/urea|nitrogen/i, "Urea"],
  [/phosphate|dap|ssp/i, "DAP / SSP"],
  [/potash|mop/i, "Potash"],
  [/field crop/i, "Fasal beej"],
  [/vegetable/i, "Sabzi beej"],
  [/cattle|dairy feed/i, "Maal / Dairy"],
  [/poultry/i, "Poultry"],
];
export function subLabel(name: string): string {
  return SUB_LABELS.find(([re]) => re.test(name))?.[1] ?? name;
}

export type ClassifiedCategory = { id: string; name: string; parent_category_id: string | null; category_kind?: string | null };
export type ClassifiedProduct<P> = P & { group: DemandGroup; sub: string | null };

/** Products ko qism + sub-category dena; Raw Grain nikal dena. */
export function classifyProducts<P extends { category_id?: string | null }>(products: P[], categories: ClassifiedCategory[]): ClassifiedProduct<P>[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: ClassifiedProduct<P>[] = [];
  for (const p of products) {
    const cat = p.category_id ? byId.get(p.category_id) : undefined;
    let root = cat;
    for (let i = 0; root?.parent_category_id && i < 5; i++) root = byId.get(root.parent_category_id) ?? root;
    const g = groupForCategory(root?.name, root?.category_kind);
    if (g === "hidden") continue;
    const sub = cat && root && cat.id !== root.id ? cat.name : null;
    out.push({ ...p, group: g, sub });
  }
  return out;
}

export function countByGroup(items: { group: DemandGroup }[]): Record<DemandGroup, number> {
  const c = Object.fromEntries(DEMAND_GROUPS.map((g) => [g, 0])) as Record<DemandGroup, number>;
  for (const i of items) c[i.group]++;
  return c;
}

/** Picker: sirf chuni hui qism, phir type chip, phir search (naam ya pack). */
export function filterProducts<P extends { name: string; pack_size?: string | null; group: DemandGroup; sub: string | null }>(
  products: P[], group: DemandGroup, sub: string | null, query: string,
): P[] {
  const q = query.trim().toLowerCase();
  return products.filter((p) =>
    p.group === group &&
    (!sub || p.sub === sub) &&
    (!q || p.name.toLowerCase().includes(q) || (p.pack_size ?? "").toLowerCase().includes(q)));
}

/** Qism ki product sub-categories, ginti ke saath (chips). */
export function subsForGroup(products: { group: DemandGroup; sub: string | null }[], group: DemandGroup): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const p of products) if (p.group === group && p.sub) m.set(p.sub, (m.get(p.sub) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Meri demands: category -> group; category na ho to product ki qism; warna other. */
export function demandRowGroup(row: { category?: string | null; product_id?: string | null }, productGroup: Map<string, DemandGroup>): DemandGroup {
  return groupOfDemandCategory(row.category) ?? (row.product_id ? productGroup.get(row.product_id) : undefined) ?? "other";
}

/** Migration 604 se pehle DB check constraint inhi ko maanta tha. */
export const PRE_604_CATEGORIES: readonly string[] = ["wanda", "khal", "chowker", "moomni", "seed", "pesticide", "fertilizer", "micronutrient"];
