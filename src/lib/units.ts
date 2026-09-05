import { createServiceClient } from "@/lib/supabase/service";
import { registerAliases } from "@/lib/product-match";

/**
 * Units aur pack sizes ke masters (273).
 *
 * Do kaam:
 *  1. Form ke liye fehrist (loadUnits / loadPackSizes).
 *  2. Matching ke liye aliases: "bori" -> bags, "5 ltr" -> 5L. Ye DB se
 *     aate hain (malik badal sakta hai), code mein nahi. loadUnitAliases()
 *     bill parhne aur sheet import se pehle ek dafa bulaya jata hai.
 */

export interface UnitRow {
  code: string;
  label: string;
  label_en: string | null;
  kind: string;
  base_code: string | null;
  factor: number | null;
  aliases: string[];
  sort_order: number;
  is_active: boolean;
}

export interface PackSizeRow {
  id: string;
  label: string;
  unit_code: string | null;
  quantity: number | null;
  aliases: string[];
  sort_order: number;
  is_active: boolean;
}

export async function loadUnits(onlyActive = true): Promise<UnitRow[]> {
  const service = createServiceClient();
  let q = service.from("units" as never).select("*").order("sort_order").order("code");
  if (onlyActive) q = q.eq("is_active", true);
  const { data } = await q;
  return ((data ?? []) as any[]).map((u) => ({ ...u, aliases: (u.aliases as string[] | null) ?? [], factor: u.factor == null ? null : Number(u.factor) })) as UnitRow[];
}

export async function loadPackSizes(onlyActive = true): Promise<PackSizeRow[]> {
  const service = createServiceClient();
  let q = service.from("pack_sizes" as never).select("*").order("sort_order").order("label");
  if (onlyActive) q = q.eq("is_active", true);
  const { data } = await q;
  return ((data ?? []) as any[]).map((p) => ({ ...p, aliases: (p.aliases as string[] | null) ?? [], quantity: p.quantity == null ? null : Number(p.quantity) })) as PackSizeRow[];
}

/** Code se label (form "unit" mein code bhejta hai; products.unit mein label rehta hai). */
export async function resolveUnit(code: string | null | undefined): Promise<{ code: string; label: string } | null> {
  const c = (code ?? "").trim().toLowerCase();
  if (!c) return null;
  const service = createServiceClient();
  const { data } = await service.from("units" as never).select("code, label").eq("code", c).maybeSingle();
  const u = data as { code: string; label: string } | null;
  return u ? { code: u.code, label: u.label } : null;
}

let cachedAt = 0;
const TTL_MS = 60_000;

/** Aliases DB se le kar matcher mein register karo (ek minute ka cache). */
export async function loadUnitAliases(force = false): Promise<void> {
  if (!force && Date.now() - cachedAt < TTL_MS) return;
  try {
    const [units, packs] = await Promise.all([loadUnits(true), loadPackSizes(true)]);
    const unitAliases: Record<string, string> = {};
    for (const u of units) {
      unitAliases[u.code] = u.code;
      for (const a of u.aliases) unitAliases[a.toLowerCase().trim()] = u.code;
    }
    const packAliases: Record<string, string> = {};
    for (const p of packs) {
      for (const a of p.aliases) packAliases[a.toLowerCase().trim()] = p.label;
    }
    registerAliases(unitAliases, packAliases);
    cachedAt = Date.now();
  } catch {
    // DB na mile to matcher apni built-in fehrist par chalta rahe.
  }
}
