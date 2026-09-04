"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

/**
 * Budget likhna.
 *
 * Budget kisi kharche ko ROKTA nahi -- ye sirf batata hai. Ye baat
 * jaan boojh kar aisi rakhi gayi hai: budget ko rok bana dene se log
 * kharcha rokte nahi, usay kisi doosre khate mein likhna shuru kar dete
 * hain, aur us ke baad na budget kaam ka rehta hai na khaate.
 */

const ROLES = ["owner", "super_admin", "admin", "finance"];

export interface BudgetState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function saveBudget(_prev: BudgetState, formData: FormData): Promise<BudgetState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return { error: "Budget likhne ki ijazat sirf Owner, Admin ya Finance ke paas hai." };
  }

  const year = Math.round(Number(formData.get("year") ?? 0));
  if (!year || year < 2000 || year > 2100) return { error: "Saal chunein." };

  const service = createServiceClient();
  let budgetId: string;
  const { data: maujood } = await service
    .from("budgets")
    .select("id")
    .eq("year", year)
    .eq("name", "Saalana budget")
    .maybeSingle();

  if (maujood) {
    budgetId = maujood.id;
  } else {
    const { data: naya, error } = await service
      .from("budgets")
      .insert({ year, name: "Saalana budget", created_by: user.id })
      .select("id")
      .single();
    if (error || !naya) return { error: `Budget nahi bana: ${error?.message ?? "maloom nahi"}` };
    budgetId = naya.id;
  }

  // Form se: amt_<code>. Khali khana matlab "is khate par budget nahi" --
  // us ki qatar mita di jati hai, sifar nahi likhi jati. Sifar ka matlab
  // "is khate par kuch nahi lagna chahiye" hai, jo alag baat hai.
  const rakhni: { budget_id: string; account_code: string; annual_amount: number }[] = [];
  const hatani: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amt_")) continue;
    const code = key.slice(4);
    const raw = String(value).trim();
    if (raw === "") {
      hatani.push(code);
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return { error: `Khata ${code}: adad theek nahi.` };
    rakhni.push({ budget_id: budgetId, account_code: code, annual_amount: n });
  }

  if (hatani.length > 0) {
    const { error } = await service.from("budget_lines").delete().eq("budget_id", budgetId).in("account_code", hatani);
    if (error) return { error: error.message };
  }
  if (rakhni.length > 0) {
    const { error } = await service.from("budget_lines").upsert(rakhni, { onConflict: "budget_id,account_code" });
    if (error) return { error: error.message };
  }

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: budgetId,
    recordLabel: `Budget ${year}`,
    description: `Budget ${year} likha gaya — ${rakhni.length} khaton par adad`,
  });

  revalidatePath("/admin/finance/budget");
  return { success: true, message: `Budget ${year} mehfooz ho gaya (${rakhni.length} khate).` };
}
