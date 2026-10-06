"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

const ROLES = ["owner", "super_admin", "admin", "finance"];

export async function saveProductCostingOverride(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Login required.");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ROLES.includes(me.role)) throw new Error("You do not have permission to edit costing.");

  const productId = String(formData.get("product_id") ?? "").trim();
  const command = String(formData.get("command") ?? "save");
  const reason = String(formData.get("reason") ?? "").trim();
  const average = Number(String(formData.get("override_average") ?? "").trim());
  if (!productId) throw new Error("Product is required.");

  const service = createServiceClient();
  const { data: product } = await service.from("products").select("id, name").eq("id", productId).maybeSingle();
  if (!product) throw new Error("Product not found.");

  if (command === "clear") {
    const { error } = await service.from("product_costing_overrides").delete().eq("product_id", productId);
    if (error) throw new Error(error.message);
    await logAudit({ actionType: "update", module: "products", recordId: productId, description: `Product costing override cleared: ${product.name}`, changes: { costing_average_override: { new: null } } });
  } else {
    if (!Number.isFinite(average) || average < 0) throw new Error("Average rate must be a valid number.");
    if (reason.length < 5) throw new Error("Correction reason is required.");
    const { error } = await service.from("product_costing_overrides").upsert({ product_id: productId, override_average: average, reason, updated_by: user.id, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await logAudit({ actionType: "update", module: "products", recordId: productId, description: `Product costing average corrected: ${product.name}`, changes: { costing_average_override: { new: average, reason } } });
  }
  revalidatePath("/admin/finance/costing");
}
