"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateHarvestDate } from "@/lib/utils/crop-duration";

async function getAvailableLand(supabase: ReturnType<typeof createClient>, farmId: string): Promise<{ total: number; used: number; available: number }> {
  const { data: farm } = await supabase.from("farms").select("area_acres").eq("id", farmId).single();
  const total = Number(farm?.area_acres ?? 0);

  const { data: activeCrops } = await supabase
    .from("crop_history")
    .select("id, area_sown_acres")
    .eq("farm_id", farmId)
    .not("area_sown_acres", "is", null);

  const cropIds = (activeCrops ?? []).map((c) => c.id);
  const { data: harvestedIds } = cropIds.length
    ? await supabase.from("harvest_records").select("crop_history_id").in("crop_history_id", cropIds)
    : { data: [] };
  const harvestedSet = new Set((harvestedIds ?? []).map((h) => h.crop_history_id));

  const used = (activeCrops ?? [])
    .filter((c) => !harvestedSet.has(c.id))
    .reduce((sum, c) => sum + Number(c.area_sown_acres), 0);

  return { total, used, available: Math.max(0, total - used) };
}

export async function addCropAction(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  const farmId = String(formData.get("farm_id") ?? "");
  if (!farmId) {
    redirect("/portal/crops?error=" + encodeURIComponent("Pehle koi farm select karein."));
  }
  const { data: farmCheck } = await supabase
    .from("farms")
    .select("id, ownership_type, rent_per_acre")
    .eq("id", farmId)
    .eq("farmer_id", farmer.id)
    .maybeSingle();
  if (!farmCheck) {
    redirect("/portal/crops?error=" + encodeURIComponent("Ye farm aap ki nahi hai."));
  }
  const cropName = String(formData.get("crop_name") ?? "");
  const sowingDate = String(formData.get("sowing_date") ?? "");
  const acreRaw = String(formData.get("area_acre") ?? "");
  const kanalRaw = String(formData.get("area_kanal") ?? "");
  const marlaRaw = String(formData.get("area_marla") ?? "");
  if (!cropName || !sowingDate) {
    redirect("/portal/crops?error=" + encodeURIComponent("Crop name aur sowing date zaroori hain."));
  }
  const acreVal = acreRaw ? parseFloat(acreRaw) : 0;
  const kanalVal = kanalRaw ? parseFloat(kanalRaw) : 0;
  const marlaVal = marlaRaw ? parseFloat(marlaRaw) : 0;
  const totalAcres = acreVal + kanalVal / 8 + marlaVal / 160;
  const areaSownAcres = totalAcres > 0 ? totalAcres : null;

  if (areaSownAcres !== null) {
    const land = await getAvailableLand(supabase, farmId);
    if (areaSownAcres > land.available) {
      redirect(
        "/portal/crops?error=" +
          encodeURIComponent(
            `Is farm mein sirf ${land.available.toFixed(2)} acre khali hai (Total ${land.total}, Pehle se use ${land.used.toFixed(2)}). Kam area likhein.`
          )
      );
    }
  }

  const expectedHarvestDate = calculateHarvestDate(cropName, new Date(sowingDate));
  const { data: newCrop, error } = await supabase
    .from("crop_history")
    .insert({
      farm_id: farmId,
      crop_name: cropName,
      sowing_date: sowingDate,
      expected_harvest_date: expectedHarvestDate.toISOString().split("T")[0],
      area_sown_acres: areaSownAcres,
      crop_year: new Date(sowingDate).getFullYear(),
    })
    .select("id")
    .single();

  if (error) {
    redirect("/portal/crops?error=" + encodeURIComponent("CROP_INSERT: " + error.message));
  }

  // Rented farm - automatically add the rent as a crop expense so the
  // farmer doesn't have to calculate/enter it manually.
  if (newCrop && farmCheck.ownership_type === "rented" && farmCheck.rent_per_acre && areaSownAcres) {
    const rentAmount = Number(farmCheck.rent_per_acre) * areaSownAcres;
    await supabase.from("crop_expenses").insert({
      crop_history_id: newCrop.id,
      expense_category: "other",
      source: "external",
      description: `Zameen Kiraya (${areaSownAcres} acre @ Rs ${farmCheck.rent_per_acre}/acre)`,
      amount: rentAmount,
    });
  }

  revalidatePath("/portal/crops");
  revalidatePath("/portal/dashboard");
  redirect("/portal/crops");
}

export async function updateCropAction(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cropId = String(formData.get("crop_id") ?? "");
  const cropName = String(formData.get("crop_name") ?? "");
  const sowingDate = String(formData.get("sowing_date") ?? "");
  const acreRaw = String(formData.get("area_acre") ?? "");
  const kanalRaw = String(formData.get("area_kanal") ?? "");
  const marlaRaw = String(formData.get("area_marla") ?? "");

  if (!cropId || !cropName || !sowingDate) {
    redirect("/portal/crops?error=" + encodeURIComponent("Sab fields zaroori hain."));
  }

  const acreVal = acreRaw ? parseFloat(acreRaw) : 0;
  const kanalVal = kanalRaw ? parseFloat(kanalRaw) : 0;
  const marlaVal = marlaRaw ? parseFloat(marlaRaw) : 0;
  const totalAcres = acreVal + kanalVal / 8 + marlaVal / 160;
  const areaSownAcres = totalAcres > 0 ? totalAcres : null;

  const expectedHarvestDate = calculateHarvestDate(cropName, new Date(sowingDate));

  const { error } = await supabase
    .from("crop_history")
    .update({
      crop_name: cropName,
      sowing_date: sowingDate,
      expected_harvest_date: expectedHarvestDate.toISOString().split("T")[0],
      area_sown_acres: areaSownAcres,
    })
    .eq("id", cropId);

  if (error) {
    redirect("/portal/crops?error=" + encodeURIComponent("CROP_UPDATE: " + error.message));
  }

  revalidatePath("/portal/crops");
  revalidatePath("/portal/dashboard");
  redirect("/portal/crops");
}

export async function deleteCropAction(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cropId = String(formData.get("crop_id") ?? "");
  if (!cropId) redirect("/portal/crops?error=" + encodeURIComponent("Crop ID missing."));

  const { error } = await supabase.from("crop_history").delete().eq("id", cropId);
  if (error) {
    redirect("/portal/crops?error=" + encodeURIComponent("Crop delete nahi ho saka - shayad is par harvest record maujood hai. " + error.message));
  }

  revalidatePath("/portal/crops");
  revalidatePath("/portal/dashboard");
  redirect("/portal/crops");
}

export interface ExpenseState {
  error?: string;
  success?: boolean;
}

export async function addCropExpenseAction(_prev: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const cropHistoryId = String(formData.get("crop_history_id") ?? "");
  const category = String(formData.get("expense_category") ?? "");
  const source = String(formData.get("source") ?? "external");
  const amount = Number(formData.get("amount") ?? 0);
  const description = (formData.get("description") as string) || null;
  const productId = (formData.get("product_id") as string) || null;

  if (!cropHistoryId) return { error: "Missing crop." };
  if (!category) return { error: "Category select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const { error } = await supabase.from("crop_expenses").insert({
    crop_history_id: cropHistoryId,
    expense_category: category,
    source,
    product_id: source === "internal" ? productId : null,
    description,
    amount,
  });

  if (error) return { error: error.message };

  revalidatePath("/portal/crops");
  return { success: true };
}

export async function bookHarvestAction(_prev: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const supabase = createClient();
  const cropHistoryId = String(formData.get("crop_history_id") ?? "");
  if (!cropHistoryId) return { error: "Missing crop." };

  const { error } = await supabase
    .from("crop_history")
    .update({ harvest_booked_at: new Date().toISOString() })
    .eq("id", cropHistoryId);

  if (error) return { error: error.message };

  revalidatePath("/portal/crops");
  revalidatePath("/portal/harvest");
  return { success: true };
}