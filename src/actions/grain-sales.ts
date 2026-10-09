"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { postCashIn, postCashOut, ACC, failed } from "@/lib/ledger/rules";
import { postJournal } from "@/lib/ledger/post";
import { stockOutPlan } from "@/lib/inventory/stock-math";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
  /** Kaam ho gaya -- aur kya hua (jaise ledger entry number). */
  notice?: string;
  paymentId?: string;
}

/** Kamyabi par saaf batao ke paisa kahan darj hua. */
async function grainPostedNotice(supabase: ReturnType<typeof createClient>, accountId: string, entryNumber: string | null | undefined, date: string, verb: "jama" | "nikal"): Promise<string> {
  const { data: acc } = await supabase.from("finance_accounts").select("name").eq("id", accountId).maybeSingle();
  const [y, m, d] = date.split("-");
  return `Ledger: ${entryNumber ?? "—"} · Cash book: ${acc?.name ?? "account"} (${verb}) · Tareekh: ${d}-${m}-${y}`;
}

/** Purani tareekh par journal ko wajah chahiye (post_journal_atomic). */
function saleBackdateReason(date: string, what: string): string | null {
  return date < aajKaKhana() ? `${what} ki asal tareekh ${date} (form par darj)` : null;
}

async function generateSaleNumber(): Promise<string> {
  const supabase = createClient();
  const year = new Date().getFullYear() % 100;
  const { data: existing } = await supabase.from("grain_sale_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;
  if (existing) {
    await supabase.from("grain_sale_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await supabase.from("grain_sale_counters").insert({ year, last_number: nextNumber });
  }
  return `GRN-SALE-${year}-${String(nextNumber).padStart(5, "0")}`;
}

async function getGrainProductId(supabase: ReturnType<typeof createClient>, grainType: string): Promise<string | null> {
  const { data } = await supabase.from("grain_type_products").select("product_id").eq("grain_type", grainType).maybeSingle();
  return data?.product_id ?? null;
}

export async function createGrainSale(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const buyerId = String(formData.get("buyer_id") ?? "");
  const grainType = String(formData.get("grain_type") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const quantity = Number(formData.get("quantity_kg") ?? 0);
  const rate = Number(formData.get("rate_per_kg") ?? 0);
  const saleDate = String(formData.get("sale_date") ?? aajKaKhana());
  const deliveryTerm = (formData.get("delivery_term") as string) || null;
  const bardanaCost = Number(formData.get("bardana_cost") ?? 0);
  const mazdooriCost = Number(formData.get("mazdoori_cost") ?? 0);
  const costAccountId = (formData.get("cost_account_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!buyerId) return { error: "Buyer select karein." };
  if (!["wheat", "rice", "maize"].includes(grainType)) return { error: "Grain type sahi select karein." };
  if (!warehouseId) return { error: "Warehouse select karein." };
  if (!quantity || quantity <= 0) return { error: "Quantity sahi likhein." };
  if (!rate || rate <= 0) return { error: "Rate sahi likhein." };
  if (bardanaCost < 0 || mazdooriCost < 0) return { error: "Bardana/Mazdoori cost sahi likhein." };
  if ((bardanaCost > 0 || mazdooriCost > 0) && !costAccountId) return { error: "Bardana/Mazdoori ka account select karein." };

  const productId = await getGrainProductId(supabase, grainType);
  if (!productId) return { error: "Grain product setup nahi hai." };

  const { data: inv } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();
  const available = Number(inv?.quantity_on_hand ?? 0);
  if (available < quantity) return { error: `Sirf ${available} kg stock available hai is warehouse mein.` };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let remaining = quantity;
  let totalCogs = 0;
  const { data: batches } = await supabase
    .from("stock_batches")
    .select("id, remaining_quantity, unit_cost")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .gt("remaining_quantity", 0)
    .order("created_at", { ascending: true });
  const plan = stockOutPlan(quantity, available, (batches ?? []).map((batch) => ({ remaining: Number(batch.remaining_quantity), unitCost: Number(batch.unit_cost ?? 0) })));
  if (!plan.ok) return { error: plan.error };
  totalCogs = plan.cost;
  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(batch.remaining_quantity));
    const { error: batchError } = await supabase.from("stock_batches").update({ remaining_quantity: Number(batch.remaining_quantity) - take }).eq("id", batch.id);
    if (batchError) return { error: batchError.message };
    remaining -= take;
  }

  const totalAmount = quantity * rate;
  const profit = totalAmount - totalCogs - bardanaCost - mazdooriCost;
  const saleNumber = await generateSaleNumber();

  const { data: sale, error } = await supabase
    .from("grain_sales")
    .insert({
      sale_number: saleNumber,
      buyer_id: buyerId,
      grain_type: grainType,
      warehouse_id: warehouseId,
      quantity_kg: quantity,
      rate_per_kg: rate,
      total_amount: totalAmount,
      total_cogs: totalCogs,
      delivery_term: deliveryTerm,
      bardana_cost: bardanaCost,
      mazdoori_cost: mazdooriCost,
      profit,
      sale_date: saleDate,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (inv) {
    // Ginti yahan se NAHI badalti -- harkat par trigger karta hai (129).
    // "grain_sale_out" bhi enum mein nahi tha, yani ye qatar hamesha
    // nakaam hoti thi aur anaj ka nikalna kahin darj hi nahi hota tha.
    await supabase.from("stock_movements").insert({
      inventory_id: inv.id,
      movement_type: "sale_out",
      quantity,
      reference_type: "grain_sale",
      reference_id: sale.id,
      created_by: user?.id ?? null,
    });
  }

  // Bika hua anaj Stock -- Grain (1220) se nikal kar lagat (5020) mein --
  // procurement ne Dr 1220 / Cr 5020 kiya tha, yahan ulta.
  if (totalCogs > 0) {
    const cogsPosted = await postJournal({
      description: `Anaj bika -- ${quantity}kg ${grainType} (${saleNumber}) ki lagat`,
      sourceModule: "grain_sale_cogs",
      sourceId: sale.id,
      entryDate: saleDate,
      backdateReason: saleBackdateReason(saleDate, `Grain sale ${saleNumber}`),
      createdBy: user?.id ?? null,
      lines: [
        { account: ACC.grainPurchase, debit: Math.round(totalCogs * 100) / 100 },
        { account: ACC.stockGrain, credit: Math.round(totalCogs * 100) / 100 },
      ],
    });
    if ("error" in cogsPosted) return { error: `Bikri ho gayi magar anaj ki lagat ledger mein nahi gayi: ${cogsPosted.error}` };
  }

  if ((bardanaCost > 0 || mazdooriCost > 0) && costAccountId) {
    const combinedCost = bardanaCost + mazdooriCost;
    const { data: costRow } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: costAccountId,
        transaction_type: "expense",
        category: "Grain Sale - Bardana/Mazdoori",
        amount: combinedCost,
        transaction_date: saleDate,
        notes: `Sale ${saleNumber} - Bardana Rs ${bardanaCost} + Mazdoori Rs ${mazdooriCost}`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (costRow?.id) {
      await postCashOut({
        accountId: costAccountId,
        amount: combinedCost,
        description: `Sale ${saleNumber} — Bardana + Mazdoori`,
        againstAccount: ACC.grainPurchase,
        ctx: {
          createdBy: user?.id ?? null,
          entryDate: saleDate,
          backdateReason: saleBackdateReason(saleDate, `Grain sale ${saleNumber} ka kharcha`),
          claims: [{ table: "finance_transactions", rowId: costRow.id }],
        },
      });
    }
    // Balance yahan se NAHI hilaya jata -- trigger khud hilata hai (023,
    // 127). Ye jagah baqi das se alag tarah kharab thi: balance INSERT SE
    // PEHLE parha jata tha aur baad mein likha jata tha. Jawab ittefaqan
    // theek aata tha, magar us darmiyan agar kisi aur ne usi khate par
    // kuch darj kar diya ho to us ka asar chup chaap mit jata.
  }

  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function recordGrainSalePayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const saleId = String(formData.get("sale_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const accountId = (formData.get("account_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!saleId) return { error: "Missing sale id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Konsa account, wo select karein." };

  const rawDate = String(formData.get("payment_date") ?? "").trim();
  const paymentDate = rawDate || aajKaKhana();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return { error: "Payment ki tareekh sahi likhein." };
  if (paymentDate > aajKaKhana()) return { error: "Payment ki tareekh aage ki nahi ho sakti." };

  const { data: sale } = await supabase.from("grain_sales").select("total_amount, amount_received, sale_number").eq("id", saleId).single();
  if (!sale) return { error: "Sale nahi mili." };
  const remaining = Math.round((Number(sale.total_amount) - Number(sale.amount_received)) * 100) / 100;
  if (amount > remaining) return { error: `Sirf Rs ${remaining.toLocaleString()} baaqi hai.` };

  // Raseed ki photo (optional). Upload pehle -- fail ho to kuch darj nahi.
  let receiptPhotoUrl: string | null = null;
  const receiptPhoto = formData.get("receipt_photo");
  if (receiptPhoto instanceof File && receiptPhoto.size > 0) {
    if (!receiptPhoto.type.startsWith("image/") && receiptPhoto.type !== "application/pdf") return { error: "Raseed sirf photo (ya PDF) ho sakti hai." };
    if (receiptPhoto.size > 10 * 1024 * 1024) return { error: "Raseed ki file 10MB se choti honi chahiye." };
    const serviceClient = createServiceClient();
    const path = `sale-${Date.now()}-${receiptPhoto.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("grain-payment-receipts").upload(path, receiptPhoto);
    if (uploadError) return { error: `Raseed upload nahi hui: ${uploadError.message}` };
    receiptPhotoUrl = serviceClient.storage.from("grain-payment-receipts").getPublicUrl(path).data.publicUrl;
  }

  const clientActionRaw = String(formData.get("client_action_id") ?? "").trim();
  const clientActionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientActionRaw) ? clientActionRaw : null;

  // Payment row, sale ka amount_received, cash book aur journal (Dr bank /
  // Cr 4010) -- sab EK database transaction mein (migration 516). Pehle ye
  // alag alag qadam the aur tareekh hamesha "aaj" likhi jati thi.
  const { data: paid, error } = await (supabase as any).rpc("fn_record_grain_sale_payment_atomic", {
    p: {
      sale_id: saleId,
      amount,
      payment_method: paymentMethod,
      account_id: accountId,
      notes,
      payment_date: paymentDate,
      receipt_photo_url: receiptPhotoUrl,
      client_action_id: clientActionId,
      backdate_reason: String(formData.get("backdate_reason") ?? "").trim() || saleBackdateReason(paymentDate, `Grain sale ${sale.sale_number} ki wasooli`),
    },
  });
  if (error) return { error: error.message };
  if (!paid?.payment_id) return { error: "Payment ka jawab nahi mila." };

  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/finance");
  return {
    success: true,
    paymentId: paid.payment_id,
    notice: await grainPostedNotice(supabase, accountId, paid.entry_number, paymentDate, "jama"),
  };
}
