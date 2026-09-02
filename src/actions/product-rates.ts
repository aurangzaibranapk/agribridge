"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * Jin products ka rate baqi tha, un ka rate bharna.
 *
 * Ek hi safhe se kai products ke rate bharte hain -- chalees ki sheet
 * charhne ke baad teen chaar rate reh jate hain, aur un ke liye ek ek
 * product ka form kholna kaam ko dobara lamba kar deta hai.
 *
 * DO USOOL:
 *
 * 1. Jo khana khali chhoRa gaya, wo NAHI badalta. Khali ka matlab
 *    "abhi bhi maloom nahi" hai, "sifar" nahi. Is liye khali khane par
 *    nishan waise ka waisa rehta hai.
 *
 * 2. Sale rate mein 0 likhna qabool nahi. products.selling_price NOT
 *    NULL hai, is liye "maloom nahi" ki jagah 0 para rehta hai -- aur
 *    agar banda khud 0 likh de to nishan hat jayega aur cheez counter
 *    par muft chali jayegi. Wo rok yahin lagti hai.
 */

export interface RateState {
  error?: string;
  notice?: string;
  success?: boolean;
  saved?: number;
}

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

export async function saveMissingRates(_prev: RateState, formData: FormData): Promise<RateState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return { error: "Rate bharna sirf Owner, Admin ya Warehouse wale ka kaam hai." };
  }

  const ids = formData.getAll("id").map(String);
  if (ids.length === 0) return { error: "Koi qatar nahi mili." };

  const num = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t.replace(/,/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  let saved = 0;
  const problems: string[] = [];

  for (const id of ids) {
    const sale = num(String(formData.get(`sale_${id}`) ?? ""));
    const trade = num(String(formData.get(`trade_${id}`) ?? ""));

    // Dono khali -- is qatar par kuch hua hi nahi.
    if (sale === null && trade === null) continue;

    const { data: p } = await supabase
      .from("products")
      .select("name, sale_rate_pending, trade_rate_pending")
      .eq("id", id)
      .maybeSingle();
    if (!p) continue;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (sale !== null) {
      if (sale === 0) {
        // 0 qeemat nahi hoti. Ye rok jaan boojh kar yahan hai: nishan
        // hatte hi cheez counter par chali jati, aur Rs 0 par bik jati.
        problems.push(`${p.name}: sale rate 0 nahi ho sakta — khali chhoR dein ya asal rate likhein.`);
      } else {
        update.selling_price = sale;
        update.sale_rate_pending = false;
      }
    }

    if (trade !== null) {
      update.purchase_price = trade;
      update.trade_rate_pending = false;
    }

    if (Object.keys(update).length === 1) continue;

    const { error } = await supabase.from("products").update(update).eq("id", id);
    if (error) {
      problems.push(`${p.name}: ${error.message}`);
      continue;
    }
    saved += 1;
  }

  if (saved > 0) {
    await logAudit({
      actionType: "update",
      module: "products",
      recordId: ids[0],
      recordLabel: "Rate baqi",
      description: `${saved} products ka rate bhara gaya`,
    });
  }

  revalidatePath("/admin/products/rates-baqi");
  revalidatePath("/admin/products");
  revalidatePath("/admin/pos");

  if (saved === 0) {
    return { error: problems.length > 0 ? problems.join(" | ") : "Kuch bhara nahi gaya." };
  }

  return {
    success: true,
    saved,
    notice:
      problems.length === 0
        ? undefined
        : `Kuch qatarein nahi charhin: ${problems.slice(0, 4).join(" | ")}`,
  };
}
