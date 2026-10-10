/**
 * Pure prefill for the supplier-bill "Product Master mein add karein" modal.
 * Every entry path (CSV warning row, row search "New Product Master", top "New Product"
 * button) builds its initial values here, so the CSV line's rates/pack/company/category
 * are never dropped.
 */
export type PrefillGroup = "karyana" | "khaad" | "wanda" | "pesticide";
export type PrefillLine = {
  row_id: string; product_id: string; query: string; unit_cost: string;
  sale_rate: string; mrp_rate: string; wholesale_rate: string;
  pack_override: string; units_per_pack_override: string;
  source_pack?: string; source_company?: string; source_category?: string; source_group?: string;
};
type Cat = { id: string; name: string; parent_category_id: string | null };
type Co = { id: string; name: string };
type Prod = { name: string; category_id: string | null; company_id: string | null };

export const PREFILL_GROUP_ROOTS: Record<PrefillGroup, string[]> = {
  karyana: ["grocery", "karyana"],
  khaad: ["fertilizer", "fertiliser", "khaad"],
  wanda: ["wanda", "animal feed", "animal feed (wanda)", "feed"],
  pesticide: ["pesticide", "pesticides", "spray"],
};
const norm = (v: string | null | undefined) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const words = (v: string) => norm(v).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);

export function groupFromText(text: string | undefined): PrefillGroup | null {
  const t = norm(text);
  if (!t) return null;
  for (const [g, roots] of Object.entries(PREFILL_GROUP_ROOTS)) if (g === t || roots.includes(t)) return g as PrefillGroup;
  return null;
}

/** Row to prefill from: explicit row, else the first unlinked CSV/draft line that has a name. */
export function pickPrefillLine<L extends PrefillLine>(lines: L[], rowId?: string | null): L | null {
  if (rowId) return lines.find((l) => l.row_id === rowId) ?? null;
  return lines.find((l) => !l.product_id && l.query.trim()) ?? null;
}

const positive = (v: string | undefined) => (Number(v) > 0 ? String(v).trim() : "");

export function buildNewProductPrefill(input: {
  line: PrefillLine | null; products: Prod[]; categories: Cat[]; companies: Co[];
  supplierCompany?: string | null; fallbackGroup: PrefillGroup;
  groupForCategory: (categoryId: string | null) => PrefillGroup | null;
  rootForGroup: (group: PrefillGroup) => { id: string } | undefined;
}) {
  const { line, products, categories, companies } = input;
  const name = line?.query.trim() ?? "";
  const ws = words(name);
  let similar: Prod | null = null; let best = 0;
  if (ws.length) for (const p of products) {
    const pw = norm(p.name).split(/[^a-z0-9]+/).filter(Boolean);
    let score = 0;
    for (let i = 0; i < Math.min(ws.length, pw.length) && ws[i] === pw[i]; i++) score += 2;
    if (!score && pw.includes(ws[0])) score = 1;
    if (score > best) { best = score; similar = p; }
  }
  // Category: CSV category name > CSV group root > similar product > fallback group root.
  const csvCat = norm(line?.source_category);
  const csvCategory = csvCat ? categories.find((c) => norm(c.name) === csvCat) ?? null : null;
  const csvGroup = groupFromText(line?.source_group) ?? groupFromText(line?.source_category);
  const group = (csvCategory ? input.groupForCategory(csvCategory.id) : null) ?? csvGroup
    ?? (similar ? input.groupForCategory(similar.category_id) : null) ?? input.fallbackGroup;
  const categoryId = csvCategory?.id
    ?? (!csvGroup && similar?.category_id && categories.some((c) => c.id === similar?.category_id) ? similar.category_id : null)
    ?? input.rootForGroup(group)?.id ?? "";
  // Company: CSV company > similar product > supplier company > first-word match.
  const csvCo = norm(line?.source_company);
  const sup = norm(input.supplierCompany);
  const companyId = (csvCo ? companies.find((c) => norm(c.name) === csvCo)?.id ?? companies.find((c) => norm(c.name).startsWith(csvCo) || csvCo.startsWith(norm(c.name)))?.id : undefined)
    ?? (similar?.company_id && companies.some((c) => c.id === similar?.company_id) ? similar.company_id : undefined)
    ?? (sup ? companies.find((c) => norm(c.name) === sup)?.id : undefined)
    ?? companies.find((c) => ws.length > 0 && norm(c.name).split(/[^a-z0-9]+/)[0] === ws[0])?.id ?? "";
  const units = Number(line?.units_per_pack_override);
  return {
    rowId: line?.row_id ?? null,
    name,
    pack: (line?.pack_override || (/^\d+\s*[×xX*]\s*\d+$/.test(String(line?.source_pack ?? "").trim()) ? "" : line?.source_pack) || "").trim(),
    unitsPerPack: units > 1 ? String(units) : "",
    purchase: positive(line?.unit_cost),
    sale: positive(line?.sale_rate),
    mrp: positive(line?.mrp_rate),
    wholesale: positive(line?.wholesale_rate),
    group, categoryId, companyId,
  };
}
