"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CycleCountBatchRow {
  product_id: string;
  product_name: string;
  category_name: string | null;
  pack_size: string | null;
  system_qty: number;
  sale_rate: number;
  last_counted: string | null;
}

export interface CycleCountItemResult {
  id: string;
  product_id: string;
  product_name: string;
  category_name: string | null;
  pack_size: string | null;
  system_qty: number;
  counted_qty: number | null;
  sale_rate: number;
  difference_qty: number;
  difference_value: number;
}

export async function getCycleCountSettings() {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from("cycle_count_settings")
    .select("cycle_days, daily_count")
    .eq("is_active", true)
    .maybeSingle();
  return { cycle_days: data?.cycle_days ?? 30, daily_count: data?.daily_count ?? 20 };
}

export async function saveCycleCountSettings(cycleDays: number, dailyCount: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaruri hai." };
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();

  // Upsert: ek hi active row hoti hai per org
  const { error } = await (supabase as any)
    .from("cycle_count_settings")
    .upsert({
      organization_id: (profile as any)?.organization_id ?? null,
      cycle_days: cycleDays,
      daily_count: dailyCount,
      is_active: true,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });

  if (error) return { error: error.message };
  revalidatePath("/admin/product-cycles");
  return { error: null };
}

export async function getTodaySession() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await (supabase as any)
    .from("cycle_count_sessions")
    .select("id, status, submitted_at")
    .eq("session_date", today)
    .maybeSingle();
  return data as { id: string; status: string; submitted_at: string | null } | null;
}

export async function startTodaySession(cycleDays: number, dailyCount: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaruri hai." };
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();

  const today = new Date().toISOString().slice(0, 10);

  // Create session
  const { data: session, error: se } = await (supabase as any)
    .from("cycle_count_sessions")
    .insert({
      organization_id: (profile as any)?.organization_id ?? null,
      session_date: today,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (se) return { error: se.message };

  // Get batch from RPC
  const { data: batch, error: be } = await (supabase as any).rpc("fn_get_cycle_count_batch", {
    p_cycle_days: cycleDays,
    p_daily_count: dailyCount,
  });
  if (be) return { error: be.message };

  if (!batch || batch.length === 0) {
    // Delete empty session
    await (supabase as any).from("cycle_count_sessions").delete().eq("id", session.id);
    return { error: "CYCLE_COMPLETE" };
  }

  // Insert items
  const items = (batch as CycleCountBatchRow[]).map((r) => ({
    session_id: session.id,
    product_id: r.product_id,
    system_qty: r.system_qty,
    sale_rate: r.sale_rate,
  }));

  const { error: ie } = await (supabase as any).from("cycle_count_items").insert(items);
  if (ie) return { error: ie.message };

  revalidatePath("/admin/product-cycles");
  return { error: null, sessionId: session.id };
}

export async function getSessionItems(sessionId: string): Promise<CycleCountItemResult[]> {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from("cycle_count_items_v")
    .select("*")
    .eq("session_id", sessionId)
    .order("product_name");
  return (data ?? []) as CycleCountItemResult[];
}

export async function saveCountedQty(itemId: string, countedQty: number) {
  const supabase = createClient();
  const { error } = await (supabase as any)
    .from("cycle_count_items")
    .update({ counted_qty: countedQty })
    .eq("id", itemId);
  return { error: error?.message ?? null };
}

export async function submitSession(sessionId: string) {
  const supabase = createClient();
  const { error } = await (supabase as any)
    .from("cycle_count_sessions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) return { error: error.message };
  revalidatePath("/admin/product-cycles");
  return { error: null };
}

export async function getCycleCountHistory(limit = 10) {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from("cycle_count_sessions")
    .select("id, session_date, status, submitted_at, cycle_count_items(id)")
    .eq("status", "submitted")
    .order("session_date", { ascending: false })
    .limit(limit);
  return (data ?? []) as Array<{ id: string; session_date: string; submitted_at: string; cycle_count_items: { id: string }[] }>;
}
