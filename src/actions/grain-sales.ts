"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postCashIn, postCashOut, ACC, failed } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
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
  const saleDate = String(formData.get("sale_date") ?? new Date().toISOString().slice(0, 10));
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
  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(batch.remaining_quantity));
    await supabase.from("stock_batches").update({ remaining_quantity: Number(batch.remaining_quantity) - take }).eq("id", batch.id);
    totalCogs += take * Number(batch.unit_cost ?? 0);
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

  const { data: sale } = await supabase.from("grain_sales").select("total_amount, amount_received, sale_number").eq("id", saleId).single();
  if (!sale) return { error: "Sale nahi mili." };
  const remaining = Number(sale.total_amount) - Number(sale.amount_received);
  if (amount > remaining) return { error: `Sirf Rs ${remaining.toLocaleString()} baaqi hai.` };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("grain_sale_payments").insert({
    sale_id: saleId,
    amount,
    payment_method: paymentMethod,
    account_id: accountId,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await supabase.from("grain_sales").update({ amount_received: Number(sale.amount_received) + amount }).eq("id", saleId);

  const { data: saleCashRow } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: accountId,
      transaction_type: "income",
      category: "Grain Sale",
      amount,
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: `Grain sale payment - ${sale.sale_number}`,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (saleCashRow?.id) {
    const posted = await postCashIn({
      accountId,
      amount,
      description: `Grain bikri ki adaigi — ${sale.sale_number}`,
      againstAccount: ACC.salesGrain,
      ctx: {
        createdBy: user?.id ?? null,
        claims: [{ table: "finance_transactions", rowId: saleCashRow.id }],
      },
    });
    if (failed(posted)) return { error: `Adaigi darj hui magar ledger mein nahi gayi: ${posted.error}` };
  }
  // Balance yahan se NAHI hilaya jata. finance_transactions mein qatar
  // daalte hi trigger khud hila deta hai (023, aur 127 se ab mitane aur
  // badalne par bhi). Pehle yahan dobara bhi hilaya jata tha, yani Rs
  // 1,000 ka asar Rs 2,000 hota tha.

  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/finance");
  return { success: true };
}