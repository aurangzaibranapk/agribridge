import type { createClient } from "@/lib/supabase/server";
import { notifyRole } from "@/lib/notifications";

// ===== L2: Company/Platform Knowledge =====
// AgriBridge ke apne Products - Rate, Availability. Farmer AI isay
// tab use karta hai jab koi treatment/product recommend karna ho.
export async function getCompanyProducts(supabase: ReturnType<typeof createClient>, searchTerm: string) {
  const { data: products } = await supabase
    .from("products")
    .select("name, category, selling_price, unit, pack_size")
    .eq("is_deleted", false)
    .eq("is_available", true)
    .ilike("name", `%${searchTerm}%`)
    .limit(5);

  return {
    products: (products ?? []).map((p) => ({
      name: p.name,
      category: p.category,
      price: Number(p.selling_price),
      unit: p.unit,
      packSize: p.pack_size,
    })),
  };
}

// ===== L3: Farmer's Own 360-Degree Context =====
// Farm/Crop/Expense History - is se AI ko pata chalta hai Farmer ki
// asal situation kya hai (jaise crop kitne din ki hai, pehle kya laga chuka hai).
export async function getFarmerContext(supabase: ReturnType<typeof createClient>, farmerId: string) {
  const { data: farms } = await supabase.from("farms").select("id, name, total_area_acres, district").eq("farmer_id", farmerId);
  const farmIds = (farms ?? []).map((f) => f.id);

  const { data: crops } = farmIds.length
    ? await supabase
        .from("crop_history")
        .select("id, crop_name, sowing_date, area_sown_acres, season, crop_year, farm_id")
        .in("farm_id", farmIds)
        .order("sowing_date", { ascending: false })
        .limit(5)
    : { data: [] };

  const cropIds = (crops ?? []).map((c) => c.id);
  const { data: expenses } = cropIds.length
    ? await supabase
        .from("crop_expenses")
        .select("expense_category, description, amount, expense_date, crop_history_id")
        .in("crop_history_id", cropIds)
        .order("expense_date", { ascending: false })
        .limit(10)
    : { data: [] };

  const today = new Date();
  const cropsWithAge = (crops ?? []).map((c) => {
    const sowDate = new Date(c.sowing_date);
    const daysOld = Math.floor((today.getTime() - sowDate.getTime()) / (1000 * 60 * 60 * 24));
    return { ...c, daysOld };
  });

  return {
    farms: (farms ?? []).map((f) => ({ name: f.name, areaAcres: Number(f.total_area_acres), district: f.district })),
    recentCrops: cropsWithAge.map((c) => ({
      cropName: c.crop_name,
      sowingDate: c.sowing_date,
      daysOld: c.daysOld,
      areaAcres: Number(c.area_sown_acres),
      season: c.season,
    })),
    recentExpenses: (expenses ?? []).map((e) => ({
      category: e.expense_category,
      description: e.description,
      amount: Number(e.amount),
      date: e.expense_date,
    })),
  };
}

// ===== L4: Live/Market Intelligence =====
// Mandi Rates - roz update hone wali Market prices.
export async function getMandiRate(supabase: ReturnType<typeof createClient>, cropName: string) {
  const { data: rates } = await supabase
    .from("mandi_rates")
    .select("mandi_name, rate_per_maund, rate_date")
    .ilike("crop_name", `%${cropName}%`)
    .order("rate_date", { ascending: false })
    .limit(5);

  if (!rates || rates.length === 0) {
    return { found: false, message: "Is Fasal ka Rate abhi database mein maujood nahi hai." };
  }
  return {
    found: true,
    rates: rates.map((r) => ({ mandi: r.mandi_name, ratePerMaund: Number(r.rate_per_maund), date: r.rate_date })),
  };
}

// ===== L5: Human Expert Escalation (Safety Gate) =====
// AI jab Confident nahi hai ya Sawal Safety-Sensitive hai (jaise exact
// chemical dosage), to khud jawab dene ki bajaye Insaan ko bulata hai.
export async function escalateToExpert(
  supabase: ReturnType<typeof createClient>,
  farmerId: string,
  question: string,
  reason: string
) {
  await supabase.from("farmer_ai_requests").insert({
    farmer_id: farmerId,
    intent_type: "expert_escalation",
    description: `Expert Escalation: ${question}`,
    details: { question, reason },
    status: "pending",
  });

  await notifyRole(
    "manager",
    "Farmer Ko Expert Advice Chahiye",
    `Sawal: "${question}" - Wajah: ${reason}`,
    "/admin/farmer-ai-requests"
  );

  return {
    escalated: true,
    message: "Ye sawal humare Agronomist/Expert team ko bhej diya gaya hai - jald hi aapko sahi jawab milega. Is waqt exact treatment ka andaza lagana surakshit nahi hai.",
  };
}