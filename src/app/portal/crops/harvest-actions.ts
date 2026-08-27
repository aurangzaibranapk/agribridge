"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function addHarvestAction(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  const farmId = String(formData.get("h_farm_id") ?? "");
  if (!farmId) {
    redirect("/portal/harvest?error=" + encodeURIComponent("Pehle koi farm select karein."));
  }
  const { data: farmCheck } = await supabase
    .from("farms")
    .select("id")
    .eq("id", farmId)
    .eq("farmer_id", farmer.id)
    .maybeSingle();
  if (!farmCheck) {
    redirect("/portal/harvest?error=" + encodeURIComponent("Ye farm aap ki nahi hai."));
  }
  const cropHistoryId = String(formData.get("h_crop_history_id") ?? "") || null;
  const cropName = String(formData.get("h_crop_name") ?? "").trim();
  const harvestDate = String(formData.get("h_harvest_date") ?? "");
  const quantityRaw = String(formData.get("h_quantity") ?? "");
  const unit = String(formData.get("h_unit") ?? "maund");
  const qualityGrade = String(formData.get("h_quality_grade") ?? "").trim();
  const saleRateRaw = String(formData.get("h_sale_rate") ?? "");
  let totalExpenseRaw = String(formData.get("h_total_expense") ?? "");

  if (!cropName || !harvestDate || !quantityRaw) {
    redirect("/portal/harvest?error=" + encodeURIComponent("Crop, harvest date aur quantity zaroori hain."));
  }

  // If linked to a tracked crop, pull the auto-calculated total expense
  // from crop_expenses instead of relying on the manual field - farmer
  // already entered this data on the My Crops page.
  let totalExpense: number | null = totalExpenseRaw ? parseFloat(totalExpenseRaw) : null;
  if (cropHistoryId && !totalExpenseRaw) {
    const { data: expenses } = await supabase
      .from("crop_expenses")
      .select("amount")
      .eq("crop_history_id", cropHistoryId);
    if (expenses && expenses.length > 0) {
      totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    }
  }

  const { error } = await supabase.from("harvest_records").insert({
    farm_id: farmId,
    crop_history_id: cropHistoryId,
    crop_name: cropName,
    harvest_date: harvestDate,
    quantity_harvested: parseFloat(quantityRaw),
    unit,
    quality_grade: qualityGrade || null,
    sale_rate: saleRateRaw ? parseFloat(saleRateRaw) : null,
    total_expense: totalExpense,
  });
  if (error) {
    redirect("/portal/harvest?error=" + encodeURIComponent("HARVEST_INSERT: " + error.message));
  }
  revalidatePath("/portal/harvest");
  revalidatePath("/portal/crops");
  redirect("/portal/harvest");
}