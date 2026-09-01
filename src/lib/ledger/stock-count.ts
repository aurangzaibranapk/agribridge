import { createServiceClient } from "@/lib/supabase/service";

/**
 * Godam ka maal gin kar hisaab se milana.
 *
 * Cash ke liye ye kaam 108 mein ho chuka. Maal ke sath masla wahi hai
 * magar bara hai -- maal chupke se nikalna cash se aasan hota hai.
 * Rs 50,000 ghayab hon to raat ko pakre jate hain; paanch bori khaad
 * ghayab ho to kisi ko pata nahi chalta, kyunki koi ginta hi nahi.
 *
 * ANDHI GINTI is poore amal ki jaan hai: ginne wale ko ye nazar nahi
 * aata ke system kya kehta hai. Screen par "42 bori honi chahiyen"
 * likha ho to ginne wala 40 gin kar bhi 42 likh dega -- kabhi be-imani
 * se, aksar is liye ke "shayad maine ghalat gina ho, system to theek
 * hi hoga". Adad chhupa dein to ginti asal mein ginti banti hai.
 */

export const REASON_MIN = 5;
/** Itne din se ginti na hui to ab ye intezar nahi, ghaflat hai. */
export const COUNT_OVERDUE_DAYS = 30;

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export interface CountLine {
  id: string;
  productId: string;
  productName: string;
  unit: string | null;
  packSize: string | null;
  /** Sirf milaan ke waqt bhara jata hai. Ginti ke dauran hamesha null. */
  expected: number | null;
  counted: number | null;
  difference: number | null;
  unitCost: number;
  differenceValue: number | null;
  reason: string | null;
}

export interface OpenCount {
  id: string;
  warehouseId: string;
  warehouseName: string;
  countDate: string;
  startedAt: string;
  startedByName: string | null;
  lines: CountLine[];
  /** Sab qataren bhar gayi hain? Tabhi milaan mumkin hai. */
  allCounted: boolean;
  /** Milaan ke qabil (sab bhar gayi) magar abhi post nahi hui. */
  needsReview: boolean;
}

/**
 * Khuli hui ginti.
 *
 * `reveal` ka faisla bulane wala karta hai, ye file khud nahi. Ginti ke
 * safhe par hamesha false jata hai; milaan ke waqt true. Default false
 * hai -- taake bhoolne ki soorat mein adad chhupa rahe, dikh na jaye.
 */
export async function openCount(
  warehouseId: string,
  reveal = false
): Promise<OpenCount | null> {
  const service = createServiceClient();

  const { data: header } = await service
    .from("stock_counts")
    .select("id, warehouse_id, count_date, started_at, warehouses(name), profiles(full_name)")
    .eq("warehouse_id", warehouseId)
    .eq("status", "counting")
    .maybeSingle();

  if (!header) return null;

  const { data: rows } = await service
    .from("stock_count_lines")
    .select(
      "id, product_id, expected_qty, counted_qty, difference_qty, unit_cost, difference_value, reason, products(name, unit, pack_size)"
    )
    .eq("count_id", header.id);

  const lines: CountLine[] = (rows ?? [])
    .map((r) => {
      const product = r.products as { name: string; unit: string | null; pack_size: string | null } | null;
      return {
        id: r.id,
        productId: r.product_id,
        productName: product?.name ?? "—",
        unit: product?.unit ?? null,
        packSize: product?.pack_size ?? null,
        expected: reveal ? Number(r.expected_qty) : null,
        counted: r.counted_qty === null ? null : Number(r.counted_qty),
        difference: r.difference_qty === null ? null : Number(r.difference_qty),
        unitCost: Number(r.unit_cost),
        differenceValue: r.difference_value === null ? null : Number(r.difference_value),
        reason: r.reason,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));

  const allCounted = lines.length > 0 && lines.every((l) => l.counted !== null);

  return {
    id: header.id,
    warehouseId: header.warehouse_id,
    warehouseName: (header.warehouses as { name: string } | null)?.name ?? "—",
    countDate: header.count_date,
    startedAt: header.started_at,
    startedByName: (header.profiles as { full_name: string | null } | null)?.full_name ?? null,
    lines,
    allCounted,
    needsReview: allCounted,
  };
}

export interface PostedCount {
  id: string;
  warehouseName: string;
  countDate: string;
  postedAt: string | null;
  totalDifferenceValue: number;
  lineCount: number;
  gapCount: number;
}

export async function recentCounts(limit = 20): Promise<PostedCount[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("stock_counts")
    .select("id, count_date, posted_at, total_difference_value, warehouses(name), stock_count_lines(difference_qty)")
    .eq("status", "posted")
    .order("posted_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => {
    const lines = (r.stock_count_lines ?? []) as { difference_qty: number | null }[];
    return {
      id: r.id,
      warehouseName: (r.warehouses as { name: string } | null)?.name ?? "—",
      countDate: r.count_date,
      postedAt: r.posted_at,
      totalDifferenceValue: Number(r.total_difference_value ?? 0),
      lineCount: lines.length,
      gapCount: lines.filter((l) => Number(l.difference_qty ?? 0) !== 0).length,
    };
  });
}

export interface OverdueWarehouse {
  warehouseId: string;
  warehouseName: string;
  lastCount: string | null;
  daysOld: number;
}

/**
 * Jin godamon ki ginti bohat arse se nahi hui.
 *
 * Kabhi na gina gaya godam sab se khatarnak hai -- wahan farq ka jama
 * hona shuru se jari hai aur kisi ne dekha hi nahi. Is liye "kabhi
 * nahi" ko sab se ooper rakha jata hai, "31 din" ke sath nahi.
 */
export async function overdueCounts(): Promise<OverdueWarehouse[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("v_stock_count_overdue")
    .select("warehouse_id, warehouse_name, aakhri_ginti, din_guzray")
    .order("din_guzray", { ascending: false });

  return (data ?? []).map((r) => ({
    warehouseId: r.warehouse_id ?? "",
    warehouseName: r.warehouse_name ?? "—",
    lastCount: r.aakhri_ginti ? String(r.aakhri_ginti).slice(0, 10) : null,
    daysOld: Number(r.din_guzray ?? 0),
  }));
}

/** Ginti ka nateeja -- kitna farq, kitni qeemat ka. */
export function summarise(lines: CountLine[]): {
  gaps: number;
  shortValue: number;
  overValue: number;
  netValue: number;
} {
  let shortValue = 0;
  let overValue = 0;
  let gaps = 0;

  for (const line of lines) {
    const diff = line.difference ?? 0;
    if (diff === 0) continue;
    gaps += 1;
    const value = diff * line.unitCost;
    if (value < 0) shortValue += Math.abs(value);
    else overValue += value;
  }

  return {
    gaps,
    shortValue: round2(shortValue),
    overValue: round2(overValue),
    netValue: round2(overValue - shortValue),
  };
}
