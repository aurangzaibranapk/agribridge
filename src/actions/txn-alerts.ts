"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";

export interface TxnAlertActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/** Len-den alerts ki settings: on/off aur kam az kam raqam. */
export async function updateTxnAlertSettings(
  _prev: TxnAlertActionState,
  formData: FormData
): Promise<TxnAlertActionState> {
  const guard = await requireAction("system.txn_alerts", "edit");
  if ("error" in guard) return { error: guard.error };

  const enabled = String(formData.get("enabled") ?? "") === "on";
  const minAmount = Number(String(formData.get("min_amount") ?? "").replace(/,/g, ""));
  if (!Number.isFinite(minAmount) || minAmount < 0) {
    return { error: "Kam az kam raqam theek likhein (misal: 1000)." };
  }

  const service = createServiceClient() as any;
  const { error } = await service
    .from("txn_whatsapp_alert_settings")
    .update({ enabled, min_amount: minAmount, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: error.message };

  revalidatePath("/admin/txn-alerts");
  return {
    success: true,
    message: enabled
      ? `Alerts chalu: Rs ${minAmount.toLocaleString("en-PK")} se upar har len-den qatar mein aaye ga.`
      : "Alerts band: nayi len-den qatar mein nahi aaye gi.",
  };
}
