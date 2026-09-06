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

// =====================================================================
// Har godam ki apni tarteeb (335)
// =====================================================================
/**
 * Malik (6 September): *"stock count wala option aisa rakhein ke hum jis
 * shop ki chahein kar sakein. Main Branch har 15 din, doosri branch har
 * month 30 din baad ya month end. Ya hum kisi ko bhi access dein ke
 * stock count karwa sakein. Hamein pata ho ga audit hua, kya farq aaya
 * hai... daily stock count ke liye bohat time lagta hai."*
 *
 * Pehle poore nizam par EK qanoon tha -- 30 din. Us mein do kharabiyan
 * thin, aur dono ka nateeja ek: nishan par se aitbaar uth jata hai.
 *
 *   * Jis godam ki ginti har 15 din chahiye, wo 29 din tak hara rehta
 *     tha -- do haftay ki ghaflat nazar hi nahi aati thi.
 *   * Jis ki mahine mein ek dafa kaafi thi, wo 31 din par surkh ho jata
 *     tha -- aur roz surkh dikhne wali cheez ko log dekhna chhoR dete
 *     hain.
 */
export type CycleKind = "har_n_din" | "mahine_ki_tareekh" | "mahine_ke_aakhir" | "band";

export const CYCLE_LABEL: Record<CycleKind, string> = {
  har_n_din: "Har kuch din baad",
  mahine_ki_tareekh: "Mahine ki ek tareekh",
  mahine_ke_aakhir: "Mahine ka aakhir",
  band: "Band (ginti nahi karni)",
};

export interface CountSchedule {
  warehouseId: string;
  warehouseName: string;
  cycleKind: CycleKind;
  /**
   * Tarteeb waqai darj hai, ya default chal raha hai.
   *
   * `false` ka matlab hai ke koi qatar hai hi nahi aur 30 din ka purana
   * qanoon lag raha hai. Safha ye farq dikhata hai -- warna malik
   * samajhte ke har godam ki tarteeb un ki chuni hui hai.
   */
  tarteebDarj: boolean;
  harNDin: number | null;
  mahineKiTareekh: number | null;
  zimmedar: string | null;
  zimmedarNaam: string | null;
  bandKiWajah: string | null;
  aakhriGinti: string | null;
  /**
   * Aakhri poori hui ginti mein kitne ka farq nikla.
   *
   * NULL = is godam ki ginti kabhi hui hi nahi. Ye SIFAR se alag hai:
   * sifar kehta hai "gine, farq nahi tha"; NULL kehta hai "kabhi gina
   * hi nahi".
   */
  pichhlaFarq: number | null;
  /** Wo aakhri din jab ginti honi chahiye thi. */
  aakhriMoqa: string | null;
  /** Us din se aaj tak kitne din. 0 = waqt par. NULL = band. */
  dinLate: number | null;
}

export async function countSchedules(): Promise<CountSchedule[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("v_stock_count_due")
    .select(
      "warehouse_id, warehouse_name, cycle_kind, tarteeb_darj, har_n_din, mahine_ki_tareekh, zimmedar, zimmedar_naam, band_ki_wajah, aakhri_ginti, pichhla_farq, aakhri_moqa, din_late"
    );

  return (data ?? [])
    .map((r) => ({
      warehouseId: (r.warehouse_id as string | null) ?? "",
      warehouseName: (r.warehouse_name as string | null) ?? "—",
      cycleKind: ((r.cycle_kind as string | null) ?? "har_n_din") as CycleKind,
      tarteebDarj: Boolean(r.tarteeb_darj),
      harNDin: r.har_n_din === null || r.har_n_din === undefined ? null : Number(r.har_n_din),
      mahineKiTareekh:
        r.mahine_ki_tareekh === null || r.mahine_ki_tareekh === undefined
          ? null
          : Number(r.mahine_ki_tareekh),
      zimmedar: (r.zimmedar as string | null) ?? null,
      zimmedarNaam: (r.zimmedar_naam as string | null) ?? null,
      bandKiWajah: (r.band_ki_wajah as string | null) ?? null,
      aakhriGinti: r.aakhri_ginti ? String(r.aakhri_ginti).slice(0, 10) : null,
      pichhlaFarq:
        r.pichhla_farq === null || r.pichhla_farq === undefined ? null : Number(r.pichhla_farq),
      aakhriMoqa: r.aakhri_moqa ? String(r.aakhri_moqa).slice(0, 10) : null,
      dinLate: r.din_late === null || r.din_late === undefined ? null : Number(r.din_late),
    }))
    // Sab se zyada late sab se ooper. Band wale (NULL) sab se neeche --
    // un par koi kaam baqi nahi.
    .sort((a, b) => (b.dinLate ?? -1) - (a.dinLate ?? -1) || a.warehouseName.localeCompare(b.warehouseName));
}
