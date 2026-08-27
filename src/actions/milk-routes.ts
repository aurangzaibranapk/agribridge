"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function recordRouteCollection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const routeName = String(formData.get("route_name") ?? "").trim();
  const branchId = (formData.get("branch_id") as string) || null;
  const riderName = (formData.get("rider_name") as string) || null;
  const collectionDate = String(formData.get("collection_date") ?? new Date().toISOString().slice(0, 10));
  const shift = String(formData.get("shift") ?? "morning");
  const fieldVolume = Number(formData.get("field_collected_volume") ?? 0);
  const chillerVolume = formData.get("chiller_received_volume") ? Number(formData.get("chiller_received_volume")) : null;
  const notes = (formData.get("notes") as string) || null;

  if (!routeName) return { error: "Route naam zaroori hai." };
  if (!fieldVolume || fieldVolume <= 0) return { error: "Field collected volume zaroori hai." };

  const { data: settings } = await supabase.from("milk_rate_settings").select("shortage_alert_threshold").limit(1).single();
  const threshold = Number(settings?.shortage_alert_threshold ?? 0.5);

  let shortageLiters: number | null = null;
  let shortagePercentage: number | null = null;
  let isRedAlert = false;

  if (chillerVolume !== null) {
    shortageLiters = fieldVolume - chillerVolume;
    shortagePercentage = fieldVolume > 0 ? (shortageLiters / fieldVolume) * 100 : 0;
    isRedAlert = shortagePercentage > threshold;
  }

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
    shortage_liters: shortageLiters,
    shortage_percentage: shortagePercentage ? Math.round(shortagePercentage * 1000) / 1000 : null,
    is_red_alert: isRedAlert,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/routes");
  return { success: true };
}

export async function updateChillerReceived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const entryId = String(formData.get("entry_id") ?? "");
  const chillerVolume = Number(formData.get("chiller_received_volume") ?? 0);
  if (!entryId) return { error: "Missing entry id." };
  if (!chillerVolume || chillerVolume <= 0) return { error: "Chiller volume zaroori hai." };

  const { data: entry } = await supabase.from("milk_route_collections").select("field_collected_volume").eq("id", entryId).single();
  if (!entry) return { error: "Entry nahi mila." };

  const { data: settings } = await supabase.from("milk_rate_settings").select("shortage_alert_threshold").limit(1).single();
  const threshold = Number(settings?.shortage_alert_threshold ?? 0.5);

  const shortageLiters = entry.field_collected_volume - chillerVolume;
  const shortagePercentage = entry.field_collected_volume > 0 ? (shortageLiters / entry.field_collected_volume) * 100 : 0;
  const isRedAlert = shortagePercentage > threshold;

  const { error } = await supabase
    .from("milk_route_collections")
    .update({
      chiller_received_volume: chillerVolume,
      shortage_liters: shortageLiters,
      shortage_percentage: Math.round(shortagePercentage * 1000) / 1000,
      is_red_alert: isRedAlert,
    })
    .eq("id", entryId);
  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/routes");
  return { success: true };
}