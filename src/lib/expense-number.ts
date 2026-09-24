import { createServiceClient } from "@/lib/supabase/service";

/**
 * Kharche ka agla number (EXP-26-00001).
 *
 * Ye pehle company-expenses ke action ke andar band tha. Ab WhatsApp se
 * aaya bill bhi issi silsile mein aata hai, is liye yahan nikal diya —
 * do jagah alag counter chalane ka matlab hota do bill ek hi number par,
 * aur number hi wo cheez hai jis se baad mein bill dhoonda jata hai.
 */
export async function nextExpenseNumber(): Promise<string> {
  const service = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await service
    .from("company_expense_counters")
    .select("last_number")
    .eq("year", year)
    .maybeSingle();
  const next = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await service.from("company_expense_counters").update({ last_number: next }).eq("year", year);
  } else {
    await service.from("company_expense_counters").insert({ year, last_number: next });
  }

  return `EXP-${year}-${String(next).padStart(5, "0")}`;
}
