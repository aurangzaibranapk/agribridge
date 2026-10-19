"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { dairyContext, todayPk } from "@/lib/portal/dairy-load";
import { breedDb } from "@/lib/portal/breeding-load";
import { PREF_TASKS, validateBreeding, validateCalving, validateHealth } from "@/lib/portal/breeding";

async function me() {
  const ctx = await dairyContext();
  if (!ctx?.farmer) redirect("/login");
  if (!ctx.gate.allowed) redirect("/portal/dairy");
  return ctx.farmer;
}
const UUID = /^[0-9a-f-]{36}$/i;
/** DB ki ghalti -> hamari key (rasta dikhane wali), warna aam ghalti. */
function dbErr(msg: string | undefined): string {
  const m = msg ?? "";
  if (/hamal pehle se khula/.test(m)) return "bh_err_open_preg";
  if (/maada/.test(m)) return "bh_err_female";
  if (/juRna/.test(m)) return "bh_err_pd";
  if (/juRa hai/.test(m)) return "bh_err_linked";
  if (/duplicate|unique/i.test(m)) return "bh_err_calf_tag_dup";
  if (/Paidaish|Aage/.test(m)) return "bh_err_date";
  if (/Bika\/mara/.test(m)) return "bh_err_gone";
  return "bh_err_generic";
}
/** Dukaan wali cheez ya pehle wala vets kharcha chuna? -> expense id (dukaan ka pehle "Shamil" hota hai). */
async function linkExpense(fd: FormData): Promise<string | null | "bad"> {
  const v = String(fd.get("link") ?? "");
  if (!v) return null;
  const db = breedDb();
  if (v.startsWith("exp:") && UUID.test(v.slice(4))) return v.slice(4);
  if (v.startsWith("pos:") && UUID.test(v.slice(4))) {
    const item = v.slice(4);
    const { data: ex } = await db.from("dairy_expenses").select("id").eq("source_ref", item).maybeSingle();
    if (ex?.id) return String(ex.id);
    const { data, error } = await db.rpc("fn_dairy_add_from_shop", { p_item: item });
    return error ? "bad" : String(data);
  }
  return "bad";
}

export async function addBreedingAction(fd: FormData) {
  const farmer = await me();
  const back = `/portal/dairy/breeding/new?type=${encodeURIComponent(String(fd.get("event_type") ?? "ai"))}&animal=${encodeURIComponent(String(fd.get("animal_id") ?? ""))}`;
  const v = validateBreeding(fd, todayPk());
  if (!v.ok) redirect(`${back}&e=${v.error}`);
  const link = await linkExpense(fd);
  if (link === "bad") redirect(`${back}&e=bh_err_link`);
  const { error } = await breedDb().from("dairy_breeding_events").insert({ ...v.value, farmer_id: farmer.id, expense_id: link });
  if (error) redirect(`${back}&e=${dbErr(error.message)}`);
  revalidatePath("/portal/dairy/breeding");
  redirect(`/portal/dairy/breeding/animal/${v.value.animal_id}?ok=1`);
}

export async function addCalvingAction(fd: FormData) {
  await me();
  const back = `/portal/dairy/breeding/new?type=calving&animal=${encodeURIComponent(String(fd.get("animal_id") ?? ""))}`;
  const v = validateCalving(fd, todayPk());
  if (!v.ok) redirect(`${back}&e=${v.error}`);
  const { error } = await breedDb().rpc("fn_dairy_record_calving", { p_animal: v.value.animal, p_date: v.value.date, p_service: v.value.service, p_ease: v.value.ease, p_calf: v.value.calf, p_notes: v.value.notes });
  if (error) redirect(`${back}&e=${dbErr(error.message)}`);
  revalidatePath("/portal/dairy");
  redirect(`/portal/dairy/breeding/animal/${v.value.animal}?ok=1`);
}

/** Timeline ka "Dry-off darj karein" -- aaj ki tareekh. */
export async function dryOffAction(fd: FormData) {
  const farmer = await me();
  const id = String(fd.get("animal_id") ?? "");
  if (!UUID.test(id)) redirect("/portal/dairy/breeding?e=bh_err_animal");
  const { error } = await breedDb().from("dairy_breeding_events").insert({ animal_id: id, farmer_id: farmer.id, event_type: "dry_off", event_date: todayPk() });
  if (error) redirect(`/portal/dairy/breeding/animal/${id}?e=${dbErr(error.message)}`);
  revalidatePath("/portal/dairy/breeding");
  redirect(`/portal/dairy/breeding/animal/${id}?ok=1`);
}

export async function voidBreedingAction(fd: FormData) {
  await me();
  const id = String(fd.get("id") ?? ""), animal = String(fd.get("animal_id") ?? "");
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 200);
  if (!UUID.test(id) || !UUID.test(animal)) redirect("/portal/dairy/breeding");
  if (reason.length < 3) redirect(`/portal/dairy/breeding/animal/${animal}?e=bh_err_reason`);
  const table = String(fd.get("kind")) === "health" ? "dairy_health_events" : "dairy_breeding_events";
  const { error } = await breedDb().from(table).update({ voided: true, void_reason: reason }).eq("id", id);
  redirect(`/portal/dairy/breeding/animal/${animal}?${error ? `e=${dbErr(error.message)}` : "ok=1"}`);
}

export async function addHealthAction(fd: FormData) {
  const farmer = await me();
  const v = validateHealth(fd, todayPk());
  if (!v.ok) redirect(`/portal/dairy/health?kind=${encodeURIComponent(String(fd.get("kind") ?? ""))}&e=${v.error}#new`);
  const link = await linkExpense(fd);
  if (link === "bad") redirect(`/portal/dairy/health?e=bh_err_link#new`);
  const { error } = await breedDb().from("dairy_health_events").insert({ ...v.value, farmer_id: farmer.id, expense_id: link });
  if (error) redirect(`/portal/dairy/health?kind=${v.value.kind}&e=${dbErr(error.message)}#new`);
  revalidatePath("/portal/dairy/health");
  redirect(`/portal/dairy/health?ok=1`);
}

/** Alert par: ho gaya / kal / laagu nahi. */
export async function taskAction(fd: FormData) {
  await me();
  const key = String(fd.get("key") ?? ""), state = String(fd.get("state") ?? "");
  const rawBack = String(fd.get("back") ?? "");
  const back = /^\/portal\/dairy(\/[a-z0-9/_-]*)?$/i.test(rawBack) ? rawBack : "/portal/dairy/alerts";
  if (!/^[a-z_]+:[A-Za-z0-9_:-]{1,120}$/.test(key) || !["done", "snoozed", "not_applicable"].includes(state)) redirect(back);
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 200) || (state === "not_applicable" ? "Laagu nahi" : null);
  const { error } = await breedDb().rpc("fn_dairy_task_set", { p_key: key, p_state: state, p_reason: reason });
  revalidatePath("/portal/dairy/alerts");
  redirect(`${back}${back.includes("?") ? "&" : "?"}${error ? "e=bh_err_generic" : "ok=1"}`);
}
export async function prefAction(fd: FormData) {
  await me();
  const type = String(fd.get("type") ?? ""), on = String(fd.get("on") ?? "") === "1";
  if (!(PREF_TASKS as readonly string[]).includes(type)) redirect("/portal/dairy/alerts");
  await breedDb().rpc("fn_dairy_task_set", { p_key: `pref:${type}`, p_state: on ? "active" : "muted", p_reason: null });
  revalidatePath("/portal/dairy/alerts");
  redirect("/portal/dairy/alerts");
}
