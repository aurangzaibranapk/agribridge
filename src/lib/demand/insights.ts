import { areaOf, demandPriority, demandScore, procurementSuggestion, type DemandPriority } from "./priority";
import { effectivePipeline, type PipelineStatus } from "./pipeline";

export interface InsightRow {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit: string;
  status: string;
  pipeline_status?: string | null;
  farmer_id: string;
  category?: string | null;
  area?: string | null;
  farmers?: { village?: string | null; tehsil?: string | null; district?: string | null } | null;
}

export function productKey(r: { product_id: string | null; product_name: string; unit: string }) {
  return `${r.product_id ?? r.product_name.trim().toLowerCase()}|${r.unit}`;
}

/** Jo demand abhi "zinda" hai -- cancel/order ban chuki shamil nahi. */
const LIVE: PipelineStatus[] = ["new", "interest_confirmed", "supplier_asked", "procurement_planned", "stock_arrived", "notified"];
/** Confirmed = staff/admin ne dilchaspi maan li (pending se aage). */
const CONFIRMED: PipelineStatus[] = ["interest_confirmed", "supplier_asked"];

export interface ProductInsight {
  key: string;
  productId: string | null;
  productName: string;
  unit: string;
  category: string | null;
  farmers: number;
  liveQuantity: number;
  confirmedQuantity: number;
  confirmedIds: string[];
  confirmedFarmers: number;
  score: number;
  priority: DemandPriority;
  areas: { area: string; farmers: number; quantity: number }[];
  pipeline: Partial<Record<PipelineStatus, number>>;
  suggestion: { confirmed: number; buffer: number; suggested: number };
}

export function buildInsights(rows: InsightRow[]): ProductInsight[] {
  const map = new Map<string, { base: ProductInsight; farmerSet: Set<string>; confFarmers: Set<string>; areaMap: Map<string, { farmers: Set<string>; quantity: number }> }>();
  for (const r of rows) {
    const p = effectivePipeline(r);
    const key = productKey(r);
    let e = map.get(key);
    if (!e) {
      e = { base: { key, productId: r.product_id, productName: r.product_name.trim(), unit: r.unit, category: r.category ?? null, farmers: 0, liveQuantity: 0, confirmedQuantity: 0, confirmedIds: [], confirmedFarmers: 0, score: 0, priority: "Low", areas: [], pipeline: {}, suggestion: { confirmed: 0, buffer: 0, suggested: 0 } },
        farmerSet: new Set(), confFarmers: new Set(), areaMap: new Map() };
      map.set(key, e);
    }
    e.base.pipeline[p] = (e.base.pipeline[p] ?? 0) + 1;
    if (!e.base.category && r.category) e.base.category = r.category;
    if (!LIVE.includes(p)) continue;
    const q = Number(r.quantity || 0);
    e.farmerSet.add(r.farmer_id);
    e.base.liveQuantity = Math.round((e.base.liveQuantity + q) * 1000) / 1000;
    if (CONFIRMED.includes(p) && r.status === "approved") {
      e.base.confirmedQuantity = Math.round((e.base.confirmedQuantity + q) * 1000) / 1000;
      e.base.confirmedIds.push(r.id);
      e.confFarmers.add(r.farmer_id);
    }
    const area = areaOf(r.farmers ?? null, r.area);
    const a = e.areaMap.get(area) ?? { farmers: new Set<string>(), quantity: 0 };
    a.farmers.add(r.farmer_id);
    a.quantity = Math.round((a.quantity + q) * 1000) / 1000;
    e.areaMap.set(area, a);
  }
  return [...map.values()].map(({ base, farmerSet, confFarmers, areaMap }) => {
    const farmers = farmerSet.size;
    return {
      ...base,
      farmers,
      confirmedFarmers: confFarmers.size,
      score: Math.round(demandScore(farmers, base.liveQuantity) * 10) / 10,
      priority: demandPriority(farmers, base.liveQuantity),
      areas: [...areaMap.entries()].map(([area, v]) => ({ area, farmers: v.farmers.size, quantity: v.quantity })).sort((x, y) => y.farmers - x.farmers || y.quantity - x.quantity),
      suggestion: procurementSuggestion(base.confirmedQuantity),
    };
  }).sort((x, y) => y.score - x.score);
}

export function notifyMessage(a: { farmerName: string; productName: string; quantity: number; unit: string }) {
  return `Assalam-o-Alaikum ${a.farmerName}! AgriBridge: aap ki demand ka ${a.productName} (${a.quantity} ${a.unit}) ab stock mein aa gaya hai. Lene ke liye dukaan par tashreef layen ya reply karein. Shukriya.`;
}
