"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { estimateMachineryCost, estimateFertilizerCost } from "@/lib/ai/cost-estimation-client";

export interface ServiceRequestState {
  error?: string;
  success?: boolean;
}

// Every service form (machinery, fertilizer, livestock) needs the
// logged-in farmer's row id first - this is shared instead of repeated
// in each action below.
async function getCurrentFarmerId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const { data: farmer } = await serviceClient.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  return farmer.id;
}

// ============================================================
// Service category selection (the "Services" cards on the dashboard)
// ============================================================
export async function toggleServiceCategory(category: "machinery" | "fertilizer" | "livestock", enabled: boolean): Promise<ServiceRequestState> {
  const farmerId = await getCurrentFarmerId();
  const serviceClient = createServiceClient();

  if (enabled) {
    const { error } = await serviceClient
      .from("service_categories")
      .upsert({ farmer_id: farmerId, category }, { onConflict: "farmer_id,category" });
    if (error) return { error: error.message };
  } else {
    const { error } = await serviceClient.from("service_categories").delete().eq("farmer_id", farmerId).eq("category", category);
    if (error) return { error: error.message };
  }

  return { success: true };
}

// ============================================================
// Machinery Rental
// ============================================================
export async function submitMachineryRequest(_prev: ServiceRequestState, formData: FormData): Promise<ServiceRequestState> {
  const farmerId = await getCurrentFarmerId();
  const serviceClient = createServiceClient();

  const machineType = String(formData.get("machine_type") ?? "");
  const machineTypeOther = String(formData.get("machine_type_other") ?? "").trim();
  const acres = formData.get("acres") ? Number(formData.get("acres")) : null;
  const expectedDate = String(formData.get("expected_date") ?? "");
  const cropType = String(formData.get("crop_type") ?? "").trim();
  const locationLat = formData.get("location_lat") ? Number(formData.get("location_lat")) : null;
  const locationLng = formData.get("location_lng") ? Number(formData.get("location_lng")) : null;
  const locationAddress = String(formData.get("location_address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const farmId = String(formData.get("farm_id") ?? "") || null;
  const willSell = String(formData.get("will_sell_to_us") ?? "");

  // Kisan ka dawa: "advance de diya hai". Ye ABHI paisa nahi hai. Yahan
  // sirf likh liya jata hai; booking banne par ye 'claimed' qatar banta
  // hai aur staff ki tasdeeq par hi ledger mein jata hai (145).
  const claimedAmount = formData.get("advance_claimed_amount")
    ? Number(formData.get("advance_claimed_amount"))
    : null;
  const claimedMethod = String(formData.get("advance_claimed_method") ?? "").trim();
  const claimedReference = String(formData.get("advance_claimed_reference") ?? "").trim();

  if (!machineType) return { error: "Please select a machine type." };
  if (claimedAmount !== null && (!Number.isFinite(claimedAmount) || claimedAmount <= 0)) {
    return { error: "Advance ki raqam sahi likhein." };
  }
  if (machineType === "other" && !machineTypeOther) return { error: "Please specify the machine you need." };
  if (!expectedDate) return { error: "Please select the date you need the machine." };

  const { data: request, error } = await serviceClient
    .from("machinery_requests")
    .insert({
      farmer_id: farmerId,
      machine_type: machineType,
      machine_type_other: machineType === "other" ? machineTypeOther : null,
      acres,
      expected_date: expectedDate,
      crop_type: cropType || null,
      location_lat: locationLat,
      location_lng: locationLng,
      location_address: locationAddress || null,
      notes: notes || null,
      farm_id: farmId,
      will_sell_to_us: willSell === "yes" ? true : willSell === "no" ? false : null,
      advance_claimed_amount: claimedAmount,
      advance_claimed_method: claimedAmount ? claimedMethod || "cash" : null,
      advance_claimed_reference: claimedAmount ? claimedReference || null : null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // AI cost estimate is best-effort - if Gemini isn't configured or the
  // call fails, the request still succeeds with no estimate shown yet.
  const estimate = await estimateMachineryCost(machineType === "other" ? machineTypeOther : machineType, acres);
  if (estimate) {
    await serviceClient
      .from("machinery_requests")
      .update({ estimated_cost: estimate.estimatedCostPkr, estimated_cost_reasoning: estimate.reasoning })
      .eq("id", request.id);
  }

  // Make sure this farmer is also marked as having opted into this
  // category, in case they reached the form via a direct link rather
  // than the dashboard toggle.
  await serviceClient
    .from("service_categories")
    .upsert({ farmer_id: farmerId, category: "machinery" }, { onConflict: "farmer_id,category" });

  return { success: true };
}

// ============================================================
// Fertilizer / Input Credit
// ============================================================
export async function submitFertilizerRequest(_prev: ServiceRequestState, formData: FormData): Promise<ServiceRequestState> {
  const farmerId = await getCurrentFarmerId();
  const serviceClient = createServiceClient();

  const cropType = String(formData.get("crop_type") ?? "").trim();
  const cultivationDate = String(formData.get("cultivation_date") ?? "");
  const locationLat = formData.get("location_lat") ? Number(formData.get("location_lat")) : null;
  const locationLng = formData.get("location_lng") ? Number(formData.get("location_lng")) : null;
  const locationAddress = String(formData.get("location_address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  // Products are submitted as parallel arrays: product_name[], quantity[], unit[]
  const productNames = formData.getAll("product_name[]").map((v) => String(v).trim());
  const quantities = formData.getAll("quantity[]").map((v) => Number(v));
  const units = formData.getAll("unit[]").map((v) => String(v));

  if (!cropType) return { error: "Please enter the crop type." };
  if (!cultivationDate) return { error: "Please select the cultivation date." };

  const items = productNames
    .map((name, i) => ({ product_name: name, quantity: quantities[i], unit: units[i] || "bags" }))
    .filter((item) => item.product_name && item.quantity > 0);

  if (items.length === 0) return { error: "Please add at least one product (e.g. Urea, DAP)." };

  const { data: request, error } = await serviceClient
    .from("fertilizer_requests")
    .insert({
      farmer_id: farmerId,
      crop_type: cropType,
      cultivation_date: cultivationDate,
      location_lat: locationLat,
      location_lng: locationLng,
      location_address: locationAddress || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { error: itemsError } = await serviceClient.from("fertilizer_items").insert(
    items.map((item) => ({
      request_id: request.id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
    }))
  );

  if (itemsError) return { error: itemsError.message };

  // AI cost estimate is best-effort - if Gemini isn't configured or the
  // call fails, the request still succeeds with no estimate shown yet.
  const estimate = await estimateFertilizerCost(items);
  if (estimate) {
    await serviceClient
      .from("fertilizer_requests")
      .update({ estimated_cost: estimate.estimatedCostPkr, estimated_cost_reasoning: estimate.reasoning })
      .eq("id", request.id);
  }

  await serviceClient
    .from("service_categories")
    .upsert({ farmer_id: farmerId, category: "fertilizer" }, { onConflict: "farmer_id,category" });

  return { success: true };
}

// ============================================================
// Livestock Loan
// ============================================================
export async function submitLivestockLoan(_prev: ServiceRequestState, formData: FormData): Promise<ServiceRequestState> {
  const farmerId = await getCurrentFarmerId();
  const serviceClient = createServiceClient();

  const cowCount = Number(formData.get("cow_count") ?? 0);
  const buffaloCount = Number(formData.get("buffalo_count") ?? 0);
  const goatCount = Number(formData.get("goat_count") ?? 0);
  const loanAmount = Number(formData.get("loan_amount") ?? 0);
  const repaymentType = String(formData.get("repayment_type") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (cowCount + buffaloCount + goatCount === 0) return { error: "Please enter at least one animal count." };
  if (!loanAmount || loanAmount <= 0) return { error: "Please enter the loan amount you need." };
  if (!["milk_installments", "lump_sum_3_months"].includes(repaymentType)) {
    return { error: "Please select a repayment method." };
  }

  const { error } = await serviceClient.from("livestock_loans").insert({
    farmer_id: farmerId,
    cow_count: cowCount,
    buffalo_count: buffaloCount,
    goat_count: goatCount,
    loan_amount: loanAmount,
    repayment_type: repaymentType,
    outstanding_amount: loanAmount,
    notes: notes || null,
  });

  if (error) return { error: error.message };

  await serviceClient
    .from("service_categories")
    .upsert({ farmer_id: farmerId, category: "livestock" }, { onConflict: "farmer_id,category" });

  return { success: true };
}