"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";
import { REASON_MIN } from "@/lib/ledger/stock-count";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Ginti shuru karna.
 *
 * Isi lamhe do cheezein mahfooz ho jati hain: system ka adad, aur maal
 * ki qeemat. Dono ko baad mein badalne se database rok deta hai.
 *
 * Adad ab mahfooz karna zaroori hai kyunki ginti ke DAURAN bikri aur
 * kharid chalti rehti hai. Baad mein milaan karte waqt inventory se
 * poochhein to farq us cheez ka niklega jo ginti ke beech mein hui --
 * aur us ka ilzam ginne wale par aayega.
 *
 * Qeemat is liye mahfooz hoti hai ke kal rate badal jaye to purani
 * ginti ka nuqsan bhi badal jata -- yani guzra hua hisaab khud ba khud
 * badalta rehta. Ye sab se mushkil qism ki ghalti hai, kyunki koi is ko
 * dhoondta bhi nahi.
 */
export async function startCount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const warehouseId = String(formData.get("warehouse_id") ?? "");
  if (!warehouseId) return { error: "Godam select karein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: existing } = await service
    .from("stock_counts")
    .select("id")
    .eq("warehouse_id", warehouseId)
    .eq("status", "counting")
    .maybeSingle();
  if (existing) return { error: "Is godam ki ek ginti pehle se khuli hai. Pehle wo mukammal karein." };

  const { data: stock } = await service
    .from("inventory")
    .select("id, product_id, quantity_on_hand, products(name, purchase_price, is_deleted)")
    .eq("warehouse_id", warehouseId);

  const rows = (stock ?? []).filter(
    (r) => !(r.products as { is_deleted: boolean } | null)?.is_deleted
  );

  if (rows.length === 0) {
    return { error: "Is godam mein koi maal darj nahi — ginne ke liye kuch nahi." };
  }

  const { data: header, error: headerError } = await service
    .from("stock_counts")
    .insert({ warehouse_id: warehouseId, started_by: user.id })
    .select("id")
    .single();
  if (headerError) return { error: headerError.message };

  const { error: lineError } = await service.from("stock_count_lines").insert(
    rows.map((r) => ({
      count_id: header.id,
      product_id: r.product_id,
      inventory_id: r.id,
      expected_qty: Number(r.quantity_on_hand),
      unit_cost: Number((r.products as { purchase_price: number } | null)?.purchase_price ?? 0),
    }))
  );
  if (lineError) return { error: lineError.message };

  revalidatePath("/admin/stock-count");
  return {
    success: true,
    message: `${rows.length} cheezon ki ginti shuru. System ka adad mahfooz ho gaya aur ab chhupa hua hai — jo aap ginein wohi likhein.`,
  };
}

/**
 * Gine hue adad bharna (ANDHI GINTI ka marhala).
 *
 * Yahan sirf gina hua adad aata hai. Farq ki baat is marhale mein hoti
 * hi nahi -- na screen par, na jawab mein. Farq abhi bata dein to agli
 * qatar par ginne wala pehle hi jaan jayega ke kya "hona chahiye".
 */
export async function saveCounts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const service = createServiceClient();
  const countId = String(formData.get("count_id") ?? "");
  if (!countId) return { error: "Ginti nahi mili." };

  const { data: count } = await service
    .from("stock_counts")
    .select("id, status")
    .eq("id", countId)
    .maybeSingle();
  if (!count) return { error: "Ginti nahi mili." };
  if (count.status !== "counting") return { error: "Ye ginti mukammal ho chuki hai." };

  const { data: lines } = await service
    .from("stock_count_lines")
    .select("id, expected_qty")
    .eq("count_id", countId);

  let filled = 0;
  for (const line of lines ?? []) {
    const raw = formData.get(`qty_${line.id}`);
    if (raw === null || String(raw).trim() === "") continue;

    const counted = Number(raw);
    if (!Number.isFinite(counted) || counted < 0) {
      return { error: "Koi adad sahi nahi likha gaya — manfi ya khali nahi ho sakta." };
    }

    const difference = round2(counted - Number(line.expected_qty));
    const { error } = await service
      .from("stock_count_lines")
      .update({ counted_qty: counted, difference_qty: difference })
      .eq("id", line.id);
    if (error) return { error: error.message };
    filled += 1;
  }

  if (filled === 0) return { error: "Koi adad nahi likha gaya." };

  revalidatePath("/admin/stock-count");
  return { success: true, message: `${filled} qataren mahfooz. Sab bhar jayen to milaan karein.` };
}

/**
 * Milaan aur mukammal karna.
 *
 * Ab dono adad saamne aate hain. Jahan farq ho wahan wajah lazmi hai.
 * Us ke baad teen kaam ek sath hote hain:
 *
 *   1. Inventory gine hue adad par set hoti hai (kyunki asal wohi hai).
 *   2. stock_movements mein nishan padta hai -- taake maal ka safar
 *      poora nazar aaye.
 *   3. Nuqsan ya izafa ledger mein jata hai. Ye teesra kaam sab se ahem
 *      hai: is ke baghair inventory to theek ho jati magar us maal ki
 *      qeemat kahin se ghayab ho jati -- yani kaghaz par kaarobar us se
 *      zyada munafa dikhata jitna hua.
 */
export async function postCount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const countId = String(formData.get("count_id") ?? "");
  if (!countId) return { error: "Ginti nahi mili." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: count } = await service
    .from("stock_counts")
    .select("id, status, warehouse_id, warehouses(name, branch_id)")
    .eq("id", countId)
    .maybeSingle();
  if (!count) return { error: "Ginti nahi mili." };
  if (count.status !== "counting") return { error: "Ye ginti pehle hi mukammal ho chuki hai." };

  const { data: lines } = await service
    .from("stock_count_lines")
    .select("id, product_id, inventory_id, expected_qty, counted_qty, difference_qty, unit_cost, reason, products(name)")
    .eq("count_id", countId);

  const rows = lines ?? [];
  const unfilled = rows.filter((r) => r.counted_qty === null);
  if (unfilled.length > 0) {
    return { error: `${unfilled.length} cheezen abhi gini nahi gayin. Milaan se pehle poori ginti lazmi hai.` };
  }

  // Wajah har us qatar par jahan farq hai.
  const missingReason: string[] = [];
  const updates: { id: string; reason: string; value: number }[] = [];

  for (const line of rows) {
    const diff = Number(line.difference_qty ?? 0);
    const reason = String(formData.get(`reason_${line.id}`) ?? "").trim();
    const name = (line.products as { name: string } | null)?.name ?? "—";

    if (diff === 0) continue;
    if (reason.length < REASON_MIN) {
      missingReason.push(name);
      continue;
    }
    updates.push({ id: line.id, reason, value: round2(diff * Number(line.unit_cost)) });
  }

  if (missingReason.length > 0) {
    return {
      error: `In cheezon ka farq bina wajah ke nahi chhora ja sakta: ${missingReason.join(", ")}. "Shayad kam aayi thi" likhna bhi kaafi hai; kuch na likhna kaafi nahi.`,
    };
  }

  // Nuqsan aur izafa alag alag gine jate hain. Sirf net dikhayein to
  // "paanch bori kam, paanch zyada" barabar nazar aata hai -- jab ke wo
  // do alag masle hain, aur dono par sawal banta hai.
  let shortValue = 0;
  let overValue = 0;
  for (const u of updates) {
    if (u.value < 0) shortValue += Math.abs(u.value);
    else overValue += u.value;
  }
  shortValue = round2(shortValue);
  overValue = round2(overValue);
  const netValue = round2(overValue - shortValue);

  let entryId: string | null = null;
  if (shortValue !== 0 || overValue !== 0) {
    const journalLines: Array<{ account: string; debit?: number; credit?: number; memo?: string }> = [];
    if (shortValue > 0) {
      journalLines.push({ account: ACC.stockLoss, debit: shortValue, memo: "Ginti mein maal kam nikla" });
      journalLines.push({ account: ACC.stockGoods, credit: shortValue, memo: "Stock ghata" });
    }
    if (overValue > 0) {
      journalLines.push({ account: ACC.stockGoods, debit: overValue, memo: "Stock barha" });
      journalLines.push({ account: ACC.stockLoss, credit: overValue, memo: "Ginti mein maal zyada nikla" });
    }

    const posted = await postJournal({
      description: `Maal ki ginti — ${(count.warehouses as { name: string } | null)?.name ?? "godam"}`,
      sourceModule: "stock_count",
      sourceId: countId,
      branchId: (count.warehouses as { branch_id: string } | null)?.branch_id ?? null,
      createdBy: user.id,
      lines: journalLines,
    });
    if ("error" in posted) return { error: `Nuqsan ledger mein darj nahi ho saka: ${posted.error}` };
    entryId = posted.id;
  }

  for (const u of updates) {
    await service
      .from("stock_count_lines")
      .update({ reason: u.reason, difference_value: u.value })
      .eq("id", u.id);
  }

  // Inventory ab gine hue adad par. Asal wohi hai jo godam mein para
  // hai, wo nahi jo kaghaz par likha tha.
  for (const line of rows) {
    const diff = Number(line.difference_qty ?? 0);
    if (diff === 0 || !line.inventory_id) continue;
    const counted = Number(line.counted_qty);

    await service
      .from("inventory")
      .update({ quantity_on_hand: counted, updated_at: new Date().toISOString() })
      .eq("id", line.inventory_id);

    await service.from("stock_movements").insert({
      inventory_id: line.inventory_id,
      movement_type: diff < 0 ? "adjustment_decrease" : "adjustment_increase",
      quantity: Math.abs(diff),
      balance_after: counted,
      reference_type: "stock_count",
      reference_id: countId,
      notes: updates.find((u) => u.id === line.id)?.reason ?? "Ginti se milaan",
      created_by: user.id,
    });
  }

  const { error } = await service
    .from("stock_counts")
    .update({
      status: "posted",
      posted_by: user.id,
      posted_at: new Date().toISOString(),
      total_difference_value: netValue,
      journal_entry_id: entryId,
    })
    .eq("id", countId);
  if (error) return { error: error.message };

  revalidatePath("/admin/stock-count");
  revalidatePath("/admin/money-trail");
  revalidatePath("/admin/inventory");

  return {
    success: true,
    message:
      updates.length === 0
        ? "Ginti mukammal — koi farq nahi nikla."
        : `Ginti mukammal. ${updates.length} cheezon mein farq mila: Rs ${shortValue.toLocaleString()} ka maal kam, Rs ${overValue.toLocaleString()} ka zyada. Nuqsan "Stock ka nuqsan" khate mein chala gaya.`,
  };
}
