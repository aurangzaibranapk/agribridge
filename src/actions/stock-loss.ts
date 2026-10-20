"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC, failed } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const HQ_ROLES = ["super_admin", "admin", "owner"];

async function generateLossNumber(): Promise<string> {
  const serviceClient = createServiceClient();
  const year = new Date().getFullYear() % 100;
  const { data, error } = await (serviceClient as any).rpc("fn_next_year_counter", { p_table: "stock_loss", p_year: year });
  if (error || data == null) throw new Error(error?.message ?? "Loss number nahi bana.");
  return `LOSS-${year}-${String(Number(data)).padStart(5, "0")}`;
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

  let lossNumber: string;
  try {
    lossNumber = await generateLossNumber();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Loss number nahi bana." };
  }
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
  if (loss.reported_by === user.id) return { error: "Jis ne nuqsan darj kiya wo khud manzoor nahi kar sakta." };
  if (loss.status !== "pending") return { success: true };

  const authorized = await isAuthorizedVerifier(supabase, user.id, loss.warehouse_id);
  if (!authorized) return { error: "Aapko is Shop ke liye verify karne ki ijazat nahi hai." };

  const { data: decisionResult, error: decisionError } = await (supabase as any).rpc("fn_decide_stock_loss", {
    p_loss: lossId,
    p_decision: decision,
    p_reason: decision === "reject" ? rejectionReason : decision === "reduced_rate" ? `Kam rate pe nikala: Rs ${reducedRate}` : null,
  });
  if (decisionError) return { error: decisionError.message };
  if (decisionResult === "already") return { success: true };
  const service = createServiceClient();
  const releaseClaim = () => (service as any).rpc("fn_release_stock_loss_claim", { p_loss: lossId });

  if (decision === "reject") {
    revalidatePath("/admin/reports/audit");
    return { success: true };
  }

  if (decision === "approve") {
    const { data: inv } = await supabase
      .from("inventory")
      .select("id, quantity_on_hand")
      .eq("warehouse_id", loss.warehouse_id)
      .eq("product_id", loss.product_id)
      .maybeSingle();
    const onHand = Number(inv?.quantity_on_hand ?? 0);
    const deduct = Math.min(Number(loss.quantity), onHand);
    const movementType =
      loss.loss_type === "damage" ? "damaged_out" : loss.loss_type === "expiry" ? "expired_out" : "loss_write_off";
    const { data: alreadyMoved, error: movedError } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("reference_type", "stock_loss")
      .eq("reference_id", lossId)
      .limit(1);
    if (movedError) {
      await releaseClaim();
      return { error: movedError.message };
    }
    if (!alreadyMoved?.length && deduct > 0) {
      if (!inv?.id) {
        await releaseClaim();
        return { error: "Stock record nahi mila." };
      }
      const { error: outError } = await (service as any).rpc("fn_record_stock_out", {
        p_warehouse: loss.warehouse_id,
        p_product: loss.product_id,
        p_qty: deduct,
        p_movement: movementType,
        p_reference_type: "stock_loss",
        p_reference_id: lossId,
        p_actor: user.id,
        p_allow_expired: movementType === "expired_out" || movementType === "damaged_out",
      });
      if (outError) {
        await releaseClaim();
        return { error: outError.message };
      }
    }
    const lossValue = Math.round(deduct * Number(loss.unit_cost ?? 0) * 100) / 100;
    const { error } = await supabase
      .from("stock_loss_records")
      .update({ status: "approved", loss_value: lossValue, approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", lossId);
    if (error) {
      await (service as any).rpc("fn_undo_reference_stock", { p_reference_type: "stock_loss", p_reference_id: lossId });
      await releaseClaim();
      return { error: error.message };
    }

    if (lossValue > 0) {
      const posted = await postJournal({
        description: `Stock loss ${loss.loss_number}: ${loss.loss_type} — ${loss.reason}`,
        sourceModule: "stock_loss",
        sourceId: lossId,
        createdBy: user.id,
        claims: [{ table: "stock_loss_records", rowId: lossId }],
        lines: [
          { account: ACC.stockLoss, debit: lossValue },
          { account: ACC.stockGoods, credit: lossValue },
        ],
      });
      if (failed(posted)) {
        await (service as any).rpc("fn_undo_reference_stock", { p_reference_type: "stock_loss", p_reference_id: lossId });
        await releaseClaim();
        revalidatePath("/admin/inventory");
        return { error: `Nuqsan ledger mein nahi gaya, is liye faisla wapas pending hai: ${posted.error}` };
      }
    }
  } else {
    if (!reducedRate || reducedRate < 0) {
      await releaseClaim();
      return { error: "Kam rate sahi likhein." };
    }
    if (reducedRate >= Number(loss.unit_cost)) {
      await releaseClaim();
      return { error: "Reduced rate original cost se kam honi chahiye." };
    }
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
      const { error: batchError } = await supabase.from("stock_batches").update({ unit_cost: reducedRate }).eq("id", batch.id);
      if (batchError) {
        await releaseClaim();
        return { error: batchError.message };
      }
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
    if (error) {
      await releaseClaim();
      return { error: error.message };
    }

    // Kam rate par nikala: stock ki qeemat ghati -> Dr Stock Loss, Cr Stock.
    // Pehle ye ledger mein jata hi nahi tha (1200 asal maal se zyada rehta).
    if (markdownLoss > 0) {
      const posted = await postJournal({
        description: `Stock markdown ${loss.loss_number}: Rs ${loss.unit_cost} -> Rs ${reducedRate}`,
        sourceModule: "stock_loss",
        sourceId: lossId,
        createdBy: user.id,
        claims: [{ table: "stock_loss_records", rowId: lossId }],
        lines: [
          { account: ACC.stockLoss, debit: markdownLoss },
          { account: ACC.stockGoods, credit: markdownLoss },
        ],
      });
      if (failed(posted)) {
        await (createServiceClient() as any).rpc("fn_release_stock_loss_claim", { p_loss: lossId });
        revalidatePath("/admin/inventory");
        return { error: `Kam rate ledger mein nahi gaya, is liye faisla wapas pending hai: ${posted.error}` };
      }
    }
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