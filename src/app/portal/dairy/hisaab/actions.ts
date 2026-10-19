"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { dairyContext, todayPk } from "@/lib/portal/dairy-load";
import { looseDb } from "@/lib/portal/dairy-pl-load";
import { validateExpense, validateIncome } from "@/lib/portal/dairy-pl";

async function me() {
  const ctx = await dairyContext();
  if (!ctx?.farmer) redirect("/login");
  if (!ctx.gate.allowed) redirect("/portal/dairy");
  return ctx.farmer;
}

export async function addExpenseAction(fd: FormData) {
  const farmer = await me();
  const v = validateExpense(fd, todayPk());
  if (!v.ok) redirect(`/portal/dairy/hisaab/expense?e=${v.error}`);
  const { error } = await looseDb().from("dairy_expenses").insert({ ...v.value, farmer_id: farmer.id, source: "manual" });
  if (error) redirect(`/portal/dairy/hisaab/expense?e=dy2_err_generic`);
  revalidatePath("/portal/dairy/hisaab");
  redirect(`/portal/dairy/hisaab?ok=1`);
}

export async function addFromShopAction(fd: FormData) {
  await me();
  const id = String(fd.get("item_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(`/portal/dairy/hisaab/expense?e=dy2_err_shop`);
  const { error } = await looseDb().rpc("fn_dairy_add_from_shop", { p_item: id });
  revalidatePath("/portal/dairy/hisaab");
  redirect(`/portal/dairy/hisaab/expense?${error ? "e=dy2_err_shop" : "ok=1"}`);
}

export async function addIncomeAction(fd: FormData) {
  const farmer = await me();
  const v = validateIncome(fd, todayPk());
  if (!v.ok) redirect(`/portal/dairy/hisaab/income?e=${v.error}`);
  const db = looseDb();
  const { error } = await db.from("dairy_income").insert({ ...v.value, farmer_id: farmer.id });
  if (error) redirect(`/portal/dairy/hisaab/income?e=dy2_err_generic`);
  if (v.value.kind === "animal_sale" && v.value.animal_id) {
    await db.from("dairy_animals").update({ status: "sold", status_date: v.value.income_date }).eq("id", v.value.animal_id);
  }
  revalidatePath("/portal/dairy/hisaab");
  redirect(`/portal/dairy/hisaab?ok=1`);
}
