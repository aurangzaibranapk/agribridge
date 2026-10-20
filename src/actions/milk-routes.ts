"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { routeVariance } from "@/lib/dairy/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function recordRouteCollection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireAction("milk-collection.routes", "create");
  if ("error" in gate) return { error: gate.error };
  const supabase = createClient();
  const routeName = String(formData.get("route_name") ?? "").trim();
  const branchId = (formData.get("branch_id") as string) || null;
  const riderName = (formData.get("rider_name") as string) || null;
  const collectionDate = String(formData.get("collection_date") ?? aajKaKhana());
  const shift = String(formData.get("shift") ?? "morning");
  const fieldVolume = Number(formData.get("field_collected_volume") ?? 0);
  const chillerVolume = formData.get("chiller_received_volume") ? Number(formData.get("chiller_received_volume")) : null;
  const notes = (formData.get("notes") as string) || null;

  if (!routeName) return { error: "Route naam zaroori hai." };
  if (!fieldVolume || fieldVolume <= 0) return { error: "Field collected volume zaroori hai." };

  const { data: settings } = await supabase.from("milk_rate_settings").select("shortage_alert_threshold").limit(1).maybeSingle();
  if (settings?.shortage_alert_threshold == null) return { error: "Kami ki hadd settings mein nahi." };
  const threshold = Number(settings.shortage_alert_threshold);
  const variance = routeVariance(fieldVolume, chillerVolume, threshold);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("milk_route_collections").insert({
    route_name: routeName,
    branch_id: branchId,
    rider_name: riderName,
    collection_date: collectionDate,
    shift,
    field_collected_volume: fieldVolume,
    chiller_received_volume: chillerVolume,
    shortage_liters: variance.shortageLiters,
    shortage_percentage: variance.shortagePercentage,
    is_red_alert: variance.isRedAlert,
    variance_kind: variance.varianceKind,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/routes");
  return { success: true };
}

export async function updateChillerReceived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireAction("milk-collection.routes", "edit");
  if ("error" in gate) return { error: gate.error };
  const supabase = createClient();
  const entryId = String(formData.get("entry_id") ?? "");
  const chillerVolume = Number(formData.get("chiller_received_volume") ?? 0);
  if (!entryId) return { error: "Missing entry id." };
  if (!chillerVolume || chillerVolume <= 0) return { error: "Chiller volume zaroori hai." };

  const { data: entry } = await supabase.from("milk_route_collections").select("field_collected_volume").eq("id", entryId).single();
  if (!entry) return { error: "Entry nahi mila." };

  const { data: settings } = await supabase.from("milk_rate_settings").select("shortage_alert_threshold").limit(1).maybeSingle();
  if (settings?.shortage_alert_threshold == null) return { error: "Kami ki hadd settings mein nahi." };
  const variance = routeVariance(Number(entry.field_collected_volume), chillerVolume, Number(settings.shortage_alert_threshold));

  const { error } = await supabase
    .from("milk_route_collections")
    .update({
      chiller_received_volume: chillerVolume,
      shortage_liters: variance.shortageLiters,
      shortage_percentage: variance.shortagePercentage,
      is_red_alert: variance.isRedAlert,
      variance_kind: variance.varianceKind,
    })
    .eq("id", entryId);
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/routes");
  return { success: true };
}