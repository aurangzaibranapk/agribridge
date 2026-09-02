"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadUnitAliases } from "@/lib/units";

export interface UnitActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

const KINDS = ["count", "weight", "volume", "length", "time", "other"];

function aliasList(raw: FormDataEntryValue | null): string[] {
  return [...new Set(String(raw ?? "").split(/[,\n;]+/).map((a) => a.trim().toLowerCase()).filter((a) => a.length > 0))];
}

async function me() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Unit banana / badalna (code primary key: naya ho to insert, warna update). */
export async function saveUnit(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { supabase, user } = await me();
  if (!user) return { error: "Login karein." };
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim();
  if (!/^[a-z0-9_]{1,20}$/.test(code)) return { error: "Code sirf chhote harf/adad (misal kg, ltr, bags)." };
  if (!label) return { error: "Label likhein (misal 'Kilogram (kg)')." };
  const kind = String(formData.get("kind") ?? "count");
  if (!KINDS.includes(kind)) return { error: "Qisam sahi nahi." };
  const factorRaw = String(formData.get("factor") ?? "").trim();
  const baseCode = String(formData.get("base_code") ?? "").trim().toLowerCase() || null;
  const payload = {
    code,
    label,
    label_en: String(formData.get("label_en") ?? "").trim() || null,
    kind,
    base_code: baseCode,
    factor: factorRaw ? Number(factorRaw) : null,
    aliases: aliasList(formData.get("aliases")),
    sort_order: Number(formData.get("sort_order") ?? 100) || 100,
    is_active: formData.get("is_active") !== "off",
  };
  if (payload.factor != null && !(payload.factor > 0)) return { error: "Factor sifar se bara ho." };
  const { error } = await supabase.from("units" as never).upsert(payload as never, { onConflict: "code" });
  if (error) return { error: error.message };
  await loadUnitAliases(true);
  revalidatePath("/admin/products/masters/units");
  revalidatePath("/admin/products/new");
  return { success: true, message: `${label} mehfooz.` };
}

export async function toggleUnit(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { supabase, user } = await me();
  if (!user) return { error: "Login karein." };
  const code = String(formData.get("code") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  const { error } = await supabase.from("units" as never).update({ is_active: active } as never).eq("code", code);
  if (error) return { error: error.message };
  await loadUnitAliases(true);
  revalidatePath("/admin/products/masters/units");
  return { success: true };
}

export async function deleteUnit(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { supabase, user } = await me();
  if (!user) return { error: "Login karein." };
  const code = String(formData.get("code") ?? "");
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("unit_code" as never, code);
  if ((count ?? 0) > 0) return { error: `${count} products is unit par hain -- delete nahi, band (inactive) karein.` };
  const { error } = await supabase.from("units" as never).delete().eq("code", code);
  if (error) return { error: error.message };
  await loadUnitAliases(true);
  revalidatePath("/admin/products/masters/units");
  return { success: true };
}

export async function savePackSize(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { supabase, user } = await me();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "").trim() || null;
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Label likhein (misal 5L, 20kg)." };
  const qtyRaw = String(formData.get("quantity") ?? "").trim();
  const payload = {
    label,
    unit_code: String(formData.get("unit_code") ?? "").trim().toLowerCase() || null,
    quantity: qtyRaw ? Number(qtyRaw) : null,
    aliases: aliasList(formData.get("aliases")),
    sort_order: Number(formData.get("sort_order") ?? 100) || 100,
    is_active: formData.get("is_active") !== "off",
  };
  const { error } = id
    ? await supabase.from("pack_sizes" as never).update(payload as never).eq("id", id)
    : await supabase.from("pack_sizes" as never).insert(payload as never);
  if (error) return { error: error.message.includes("duplicate") ? `"${label}" pehle se hai.` : error.message };
  await loadUnitAliases(true);
  revalidatePath("/admin/products/masters/pack-sizes");
  revalidatePath("/admin/products/new");
  return { success: true, message: `${label} mehfooz.` };
}

export async function deletePackSize(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { supabase, user } = await me();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("pack_sizes" as never).delete().eq("id", id);
  if (error) return { error: error.message };
  await loadUnitAliases(true);
  revalidatePath("/admin/products/masters/pack-sizes");
  return { success: true };
}
