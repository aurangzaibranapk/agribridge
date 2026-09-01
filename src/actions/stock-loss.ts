"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const HQ_ROLES = ["super_admin", "admin", "owner"];

async function generateLossNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;
  const { data: existing } = await serviceClient.from("stock_loss_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;
  if (existing) {
    await serviceClient.from("stock_loss_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await serviceClient.from("stock_loss_counters").insert({ year, last_number: nextNumber });
  }
  return `LOSS-${year}-${String(nextNumber).padStart(5, "0")}`;
}

export async function reportLoss(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const lossType = String(formData.get("loss_type") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!warehouseId) return { error: "Shop/Warehouse select karein." };
  if (!productId) return { error: "Product select karein." };
  if (!quantity || quantity <= 0) return { error: "Quantity sahi likhein." };
  if (!lossType) return { error: "Loss ki type select karein." };
  if (!reason) return { error: "Wajah likhna zaroori hai." };

  const { data: product } = await supabase.from("products").select("purchase_price").eq("id", productId).maybeSingle();
  const unitCost = Number(product?.purchase_price ?? 0);

  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const path = `${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("stock-loss-photos").upload(path, photo);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("stock-loss-photos").getPublicUrl(path);
      photoUrl = data.publicUrl;
    }
  }

  const lossNumber = await generateLossNumber();
  const { error } = await supabase.from("stock_loss_records").insert({
    loss_number: lossNumber,
    warehouse_id: warehouseId,
    product_id: productId,
    quantity,
    unit_cost: unitCost,
    loss_value: quantity * unitCost,
    loss_type: lossType,
    reason,
    photo_url: photoUrl,
    status: "pending",
    reported_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/reports/audit");
  return { success: true };
}

async function isAuthorizedVerifier(supabase: ReturnType<typeof createClient>, userId: string, warehouseId: string): Promise<boolean> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role && HQ_ROLES.includes(profile.role)) return true;

  const { data: warehouse } = await supabase.from("warehouses").select("shop_id").eq("id", warehouseId).maybeSingle();
  const { data: grants } = await supabase.from("loss_verifiers").select("shop_id").eq("profile_id", userId);
  if (!grants) return false;
  return grants.some((g) => g.shop_id === null || g.shop_id === warehouse?.shop_id);
}

export async function verifyLossRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const lossId = String(formData.get("loss_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const rejectionReason = (formData.get("rejection_reason") as string) || null;
  const reducedRate = Number(formData.get("reduced_rate") ?? 0);

  if (!lossId) return { error: "Missing loss id." };
  if (!["approve", "reject", "reduced_rate"].includes(decision)) return { error: "Sahi decision select karein." };

  const { data: loss } = await supabase.from("stock_loss_records").select("*").eq("id", lossId).single();
  if (!loss) return { error: "Loss record nahi mila." };
  if (loss.status !== "pending") return { error: "Ye record pehle hi process ho chuka hai." };

  const authorized = await isAuthorizedVerifier(supabase, user.id, loss.warehouse_id);
  if (!authorized) return { error: "Aapko is Shop ke liye verify karne ki ijazat nahi hai." };

  if (decision === "reject") {
    if (!rejectionReason) return { error: "Reject karne ki wajah likhein." };
    const { error } = await supabase
      .from("stock_loss_records")
      .update({ status: "rejected", rejection_reason: rejectionReason, approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", lossId);
    if (error) return { error: error.message };
  } else if (decision === "approve") {
    const { data: inv } = await supabase
      .from("inventory")
      .select("id, quantity_on_hand")
      .eq("warehouse_id", loss.warehouse_id)
      .eq("product_id", loss.product_id)
      .maybeSingle();
    if (inv) {
      const deduct = Math.min(Number(loss.quantity), Number(inv.quantity_on_hand));
      // Ginti yahan se NAHI badalti -- harkat par trigger karta hai (129).
      await supabase.from("stock_movements").insert({
        inventory_id: inv.id,
        // Naam nuqsan ki apni qism se aata hai. Pehle yahan hamesha
        // "loss_write_off" likha jata tha -- ek aisa lafz jo enum mein
        // tha hi nahi, is liye ye qatar kabhi bani hi nahi aur nuqsan ka
        // koi kaghaz nahi banta tha. Chori ko "damaged" keh dena bhi
        // ghalat hota, is liye teesra lafz alag rakha gaya hai (129).
        movement_type:
          loss.loss_type === "damage" ? "damaged_out" : loss.loss_type === "expiry" ? "expired_out" : "loss_write_off",
        quantity: deduct,
        reference_type: "stock_loss",
        reference_id: lossId,
        created_by: user.id,
      });
    }
    const { error } = await supabase
      .from("stock_loss_records")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", lossId);
    if (error) return { error: error.message };
  } else {
    if (!reducedRate || reducedRate < 0) return { error: "Kam rate sahi likhein." };
    if (reducedRate >= Number(loss.unit_cost)) return { error: "Reduced rate original cost se kam honi chahiye." };
    const markdownLoss = (Number(loss.unit_cost) - reducedRate) * Number(loss.quantity);

    const { data: batches } = await supabase
      .from("stock_batches")
      .select("id, remaining_quantity")
      .eq("warehouse_id", loss.warehouse_id)
      .eq("product_id", loss.product_id)
      .gt("remaining_quantity", 0)
      .order("created_at", { ascending: true });
    let remaining = Number(loss.quantity);
    for (const batch of batches ?? []) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(batch.remaining_quantity));
      await supabase.from("stock_batches").update({ unit_cost: reducedRate }).eq("id", batch.id);
      remaining -= take;
    }

    const { error } = await supabase
      .from("stock_loss_records")
      .update({
        status: "approved",
        loss_value: markdownLoss,
        rejection_reason: `Kam rate pe nikala: Rs ${reducedRate} (original: Rs ${loss.unit_cost})`,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", lossId);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/reports/audit");
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function grantLossVerifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile?.role || !HQ_ROLES.includes(profile.role)) return { error: "Sirf Admin ye permission de sakta hai." };

  const profileId = String(formData.get("profile_id") ?? "");
  const shopId = (formData.get("shop_id") as string) || null;
  if (!profileId) return { error: "Staff member select karein." };

  const { error } = await supabase.from("loss_verifiers").insert({ profile_id: profileId, shop_id: shopId, granted_by: user.id });
  if (error) return { error: error.message };
  revalidatePath("/admin/reports/audit/verifiers");
  return { success: true };
}

export async function revokeLossVerifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile?.role || !HQ_ROLES.includes(profile.role)) return { error: "Sirf Admin ye permission hata sakta hai." };

  const grantId = String(formData.get("grant_id") ?? "");
  const { error } = await supabase.from("loss_verifiers").delete().eq("id", grantId);
  if (error) return { error: error.message };
  revalidatePath("/admin/reports/audit/verifiers");
  return { success: true };
}