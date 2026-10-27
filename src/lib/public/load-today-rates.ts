import { pktDayKey } from "@/lib/reports/sales-period";
import { createServiceClient } from "@/lib/supabase/service";
import {
  chooseWheat,
  dominantRate,
  EMPTY_PUBLIC_RATE,
  pktTodayYesterday,
  presentSeries,
  type PublicRates,
  type WeightedRate,
} from "@/lib/public/today-rates";

type MilkRow = { entry_date: string; rate_per_liter: number | null; quantity_liters: number | null; branch_id: string | null };
type GrainRow = { entry_date: string; rate_per_kg: number; weight_kg: number };
type MandiRow = { mandi_name: string | null; rate_per_maund: number; rate_date: string };

function firstError(parts: { error: { message: string } | null }[]): string | null {
  return parts.map((p) => p.error?.message).find(Boolean) ?? null;
}

/** Server-only. Anon in tables nahi parh sakta, is liye service role sirf rate ka adad nikalta hai — kisan ka naam nahi. */
export async function loadPublicRates(now = new Date()): Promise<PublicRates> {
  const { today, yesterday } = pktTodayYesterday(now);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { today, milk: EMPTY_PUBLIC_RATE, wheat: EMPTY_PUBLIC_RATE, note: "Rate ka record is server par nahi khula." };
  }
  try {
    const supabase = createServiceClient();
    const [branches, milkToday, milkY, standard, grainToday, grainY, grainLast, mandi] = await Promise.all([
      supabase.from("branches").select("id, name").ilike("name", "%mahabali%"),
      supabase.from("milk_entries").select("entry_date, rate_per_liter, quantity_liters, branch_id").eq("entry_date", today).not("rate_per_liter", "is", null).limit(5000),
      supabase.from("milk_entries").select("entry_date, rate_per_liter, quantity_liters, branch_id").eq("entry_date", yesterday).not("rate_per_liter", "is", null).limit(5000),
      supabase.from("milk_rate_settings").select("standard_rate, updated_at").limit(1).maybeSingle(),
      supabase.from("grain_procurement_entries").select("entry_date, rate_per_kg, weight_kg").eq("grain_type", "wheat").eq("entry_date", today).is("reclassified_as_sale_id", null).limit(2000),
      supabase.from("grain_procurement_entries").select("entry_date, rate_per_kg, weight_kg").eq("grain_type", "wheat").eq("entry_date", yesterday).is("reclassified_as_sale_id", null).limit(2000),
      supabase.from("grain_procurement_entries").select("entry_date, rate_per_kg, weight_kg").eq("grain_type", "wheat").is("reclassified_as_sale_id", null).order("entry_date", { ascending: false }).limit(1),
      supabase.from("mandi_rates").select("crop_name, mandi_name, rate_per_maund, rate_date").or("crop_name.ilike.%wheat%,crop_name.ilike.%gandum%,crop_name.ilike.%گندم%").order("rate_date", { ascending: false }).limit(40),
    ]);
    const err = firstError([branches, milkToday, milkY, standard, grainToday, grainY, grainLast, mandi]);
    if (err) return { today, milk: EMPTY_PUBLIC_RATE, wheat: EMPTY_PUBLIC_RATE, note: err };

    const mahabaliIds = new Set((branches.data ?? []).map((b) => b.id));
    const milkScope = (rows: MilkRow[] | null): WeightedRate[] => {
      const list = rows ?? [];
      const scoped = mahabaliIds.size ? list.filter((r) => r.branch_id && mahabaliIds.has(r.branch_id)) : list;
      return scoped
        .filter((r) => Number(r.rate_per_liter) > 0)
        .map((r) => ({ date: String(r.entry_date).slice(0, 10), rate: Number(r.rate_per_liter), weight: Number(r.quantity_liters) || 1 }));
    };

    let milkRows = [...milkScope(milkToday.data), ...milkScope(milkY.data)];
    if (dominantRate(milkRows, today) == null) {
      let lastQ = supabase.from("milk_entries").select("entry_date").not("rate_per_liter", "is", null).order("entry_date", { ascending: false }).limit(1);
      if (mahabaliIds.size) lastQ = lastQ.in("branch_id", [...mahabaliIds]);
      const { data: last, error: lastErr } = await lastQ;
      if (lastErr) return { today, milk: EMPTY_PUBLIC_RATE, wheat: EMPTY_PUBLIC_RATE, note: lastErr.message };
      const lastDate = last?.[0]?.entry_date ? String(last[0].entry_date).slice(0, 10) : null;
      if (lastDate && lastDate !== today && lastDate !== yesterday) {
        let dayQ = supabase.from("milk_entries").select("entry_date, rate_per_liter, quantity_liters, branch_id").eq("entry_date", lastDate).not("rate_per_liter", "is", null).limit(2000);
        if (mahabaliIds.size) dayQ = dayQ.in("branch_id", [...mahabaliIds]);
        const { data: dayRows, error: dayErr } = await dayQ;
        if (dayErr) return { today, milk: EMPTY_PUBLIC_RATE, wheat: EMPTY_PUBLIC_RATE, note: dayErr.message };
        milkRows = [...milkRows, ...milkScope(dayRows)];
      }
    }

    const standardToday = standard.data && pktDayKey(standard.data.updated_at) === today ? Number(standard.data.standard_rate) : null;
    const milkSource = mahabaliIds.size ? "Mahabali MCC · litre" : "Doodh collection · litre";
    const milk = presentSeries(
      today,
      yesterday,
      milkRows,
      milkRows.some((r) => r.date === today) ? null : standardToday,
      milkSource,
      "Standard rate · litre",
    );

    const asWheat = (rows: GrainRow[] | null): WeightedRate[] =>
      (rows ?? [])
        .filter((r) => Number(r.rate_per_kg) > 0)
        .map((r) => ({ date: String(r.entry_date).slice(0, 10), rate: Number(r.rate_per_kg), weight: Number(r.weight_kg) || 1 }));

    let procurement = [...asWheat(grainToday.data), ...asWheat(grainY.data)];
    const lastGrainDate = grainLast.data?.[0]?.entry_date ? String(grainLast.data[0].entry_date).slice(0, 10) : null;
    if (lastGrainDate && lastGrainDate !== today && lastGrainDate !== yesterday && dominantRate(procurement, today) == null) {
      const { data: older, error: olderErr } = await supabase
        .from("grain_procurement_entries")
        .select("entry_date, rate_per_kg, weight_kg")
        .eq("grain_type", "wheat")
        .eq("entry_date", lastGrainDate)
        .is("reclassified_as_sale_id", null)
        .limit(2000);
      if (olderErr) return { today, milk: EMPTY_PUBLIC_RATE, wheat: EMPTY_PUBLIC_RATE, note: olderErr.message };
      procurement = [...procurement, ...asWheat(older)];
    }

    const mandiRows: WeightedRate[] = ((mandi.data ?? []) as MandiRow[])
      .filter((r) => Number(r.rate_per_maund) > 0)
      .map((r) => ({ date: String(r.rate_date).slice(0, 10), rate: Number(r.rate_per_maund), weight: /mahabali/i.test(r.mandi_name ?? "") ? 1000 : 1 }));

    return { today, milk, wheat: chooseWheat(today, yesterday, procurement, mandiRows), note: null };
  } catch (err) {
    return {
      today,
      milk: EMPTY_PUBLIC_RATE,
      wheat: EMPTY_PUBLIC_RATE,
      note: err instanceof Error ? err.message : "Rate nahi mila",
    };
  }
}
