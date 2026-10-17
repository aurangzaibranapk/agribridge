"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dairyContext, todayPk } from "@/lib/portal/dairy-load";
import { STATUSES, parseLiters, validateAnimal, validateDate } from "@/lib/portal/dairy";

// 566/567 abhi generated types mein nahi.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createClient() as any;

async function me() {
  const ctx = await dairyContext();
  if (!ctx?.farmer) redirect("/login");
  if (!ctx.gate.allowed) redirect("/portal/dairy");
  return ctx.farmer;
}

export async function addAnimalAction(fd: FormData) {
  const farmer = await me();
  const sb = db();
  const { data: existing } = await sb.from("dairy_animals").select("tag_no");
  const v = validateAnimal(fd, todayPk(), (existing ?? []).map((r: { tag_no: string }) => r.tag_no));
  if (!v.ok) redirect(`/portal/dairy/animals/new?e=${v.error}`);
  const { data, error } = await sb.from("dairy_animals").insert({ ...v.value, farmer_id: farmer.id }).select("id").single();
  if (error) redirect(`/portal/dairy/animals/new?e=${/unique|duplicate/i.test(error.message) ? "dy_err_tag_dup" : "dy_err_generic"}`);
  revalidatePath("/portal/dairy");
  redirect(`/portal/dairy/animals/${data.id}?ok=1`);
}

export async function setStatusAction(fd: FormData) {
  await me();
  const id = String(fd.get("id") ?? ""), status = String(fd.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(STATUSES as readonly string[]).includes(status)) redirect("/portal/dairy/animals");
  const { error } = await db().from("dairy_animals").update({ status, status_date: todayPk() }).eq("id", id);
  redirect(`/portal/dairy/animals/${id}${error ? "?e=dy_err_generic" : "?ok=1"}`);
}

export async function bulkMilkAction(fd: FormData) {
  await me();
  const date = String(fd.get("date") ?? ""), shift = fd.get("shift") === "pm" ? "pm" : "am";
  const back = (q: string) => redirect(`/portal/dairy/milk?d=${encodeURIComponent(date)}&s=${shift}&${q}`);
  if (!validateDate(date, todayPk())) back("e=dy_err_date");
  const rows: { animal_id: string; liters: number }[] = [];
  for (const [k, raw] of Array.from(fd.entries())) {
    if (!k.startsWith("l_")) continue;
    const l = parseLiters(String(raw));
    if (l === "bad") back("e=dy_err_litres");
    if (l === null || l === "bad") continue;
    rows.push({ animal_id: k.slice(2), liters: l });
  }
  if (!rows.length) back("e=dy_err_litres");
  const { data, error } = await db().rpc("fn_dairy_bulk_milk", { p_date: date, p_shift: shift, p_rows: rows });
  if (error) back("e=dy_err_generic");
  revalidatePath("/portal/dairy");
  back(`n=${Number(data) || rows.length}`);
}

export async function singleMilkAction(fd: FormData) {
  await me();
  const date = String(fd.get("date") ?? ""), shift = fd.get("shift") === "pm" ? "pm" : "am", animal = String(fd.get("animal_id") ?? "");
  const ret = String(fd.get("ret") ?? "") === "detail" ? `/portal/dairy/animals/${animal}` : `/portal/dairy/milk`;
  const back = (q: string) => redirect(`${ret}?d=${encodeURIComponent(date)}&s=${shift}&a=${animal}&${q}`);
  if (!validateDate(date, todayPk())) back("e=dy_err_date");
  const l = parseLiters(String(fd.get("liters") ?? ""));
  if (l === null || l === "bad") back("e=dy_err_litres");
  const fatRaw = String(fd.get("fat") ?? "").trim();
  const fat = fatRaw ? Number(fatRaw) : null;
  if (fat !== null && (!Number.isFinite(fat) || fat < 0 || fat > 15)) back("e=dy_err_generic");
  const { error } = await db().rpc("fn_dairy_bulk_milk", {
    p_date: date, p_shift: shift, p_rows: [{ animal_id: animal, liters: l, fat: fat ?? "", withheld: fd.get("withheld") === "1" }],
  });
  if (error) back("e=dy_err_generic");
  revalidatePath("/portal/dairy");
  back("ok=1");
}
