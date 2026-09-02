"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * Kya mangwana hai (262) -> Purchase ka draft.
 *
 * Safha bikri ki raftaar se tadad sujhata hai; banda tadad aur supplier
 * dekh kar "purchase banayein" dabata hai. Har supplier ki alag
 * purchase banti hai, PENDING aur manzoori ke liye (259) -- yani maal
 * aur dena tab charhta hai jab manzoor ho kar receive ho. Rate: aakhri
 * kharid ka, na ho to product ka trade rate; wo bhi baqi ho to qatar
 * nahi jati -- sifar par kharidna jhoot hota.
 */

export interface ReorderState {
  error?: string;
  notice?: string;
  success?: boolean;
  made?: number;
}

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

export async function createReorderPurchases(_prev: ReorderState, formData: FormData): Promise<ReorderState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return { error: "Purchase banana sirf Owner, Admin ya Warehouse wale ka kaam hai." };
  }

  const ids = formData.getAll("pick").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "Koi qatar nahi chuni." };

  type Line = { product_id: string; name: string; qty: number; cost: number | null; supplier_id: string | null };
  const lines: Line[] = [];
  const problems: string[] = [];

  const { data: products } = await supabase
    .from("products")
    .select("id, name, purchase_price, trade_rate_pending")
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue;
    const qty = Number(String(formData.get(`qty_${id}`) ?? "").replace(/,/g, ""));
    const supplierId = String(formData.get(`sup_${id}`) ?? "").trim() || null;
    const costRaw = String(formData.get(`cost_${id}`) ?? "").trim();
    const cost = costRaw ? Number(costRaw) : p.trade_rate_pending ? null : Number(p.purchase_price);
    if (!Number.isFinite(qty) || qty <= 0) {
      problems.push(`${p.name}: tadad nahi`);
      continue;
    }
    if (!supplierId) {
      problems.push(`${p.name}: supplier nahi chuna`);
      continue;
    }
    if (cost == null || !Number.isFinite(cost) || cost <= 0) {
      problems.push(`${p.name}: trade rate baqi -- pehle rate bharein`);
      continue;
    }
    lines.push({ product_id: id, name: p.name, qty, cost, supplier_id: supplierId });
  }
  if (lines.length === 0) return { error: `Kuch nahi bana: ${problems.slice(0, 5).join(" | ")}` };

  // Branch: apni, warna main.
  let branchId = me.branch_id ?? null;
  if (!branchId) {
    const { data: main } = await supabase.from("branches").select("id").eq("is_main_branch", true).limit(1).maybeSingle();
    branchId = main?.id ?? null;
  }

  const bySupplier = new Map<string, Line[]>();
  for (const l of lines) {
    const arr = bySupplier.get(l.supplier_id as string) ?? [];
    arr.push(l);
    bySupplier.set(l.supplier_id as string, arr);
  }

  let made = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const [supplierId, group] of bySupplier) {
    const purchaseNumber = `PO-${Date.now()}-${made + 1}`;
    const total = group.reduce((s, l) => s + l.qty * (l.cost as number), 0);
    const { data: po, error: poErr } = await supabase
      .from("purchases")
      .insert({
        purchase_number: purchaseNumber,
        supplier_id: supplierId,
        branch_id: branchId,
        purchase_date: today,
        status: "pending",
        // Raftaar se bana draft: manzoori ke baghair receive nahi (259).
        review_status: "submitted",
        total_amount: total,
        payment_terms: "credit",
        notes: "Kya Mangwana Hai (bikri ki raftaar) se bana draft",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (poErr || !po) {
      problems.push(`Supplier ${supplierId.slice(0, 8)}: purchase nahi bani: ${poErr?.message}`);
      continue;
    }
    for (const l of group) {
      const { data: batch } = await supabase
        .from("stock_batches")
        .insert({ product_id: l.product_id, batch_number: `${purchaseNumber}-${l.product_id.slice(0, 8)}`, initial_quantity: l.qty })
        .select("id")
        .single();
      const { error: itemErr } = await supabase.from("purchase_items").insert({
        purchase_id: po.id,
        product_id: l.product_id,
        batch_id: batch?.id ?? null,
        quantity: l.qty,
        unit_cost: l.cost as number,
        line_total: l.qty * (l.cost as number),
      });
      if (itemErr) problems.push(`${l.name}: ${itemErr.message}`);
    }
    await supabase.from("purchase_comments").insert({
      purchase_id: po.id,
      author_id: user.id,
      kind: "submit",
      body: `Bikri ki raftaar se sujhaav: ${group.map((l) => `${l.name} x ${l.qty}`).join(", ")}`,
    });
    made += 1;
  }

  if (made > 0) {
    await logAudit({
      actionType: "create",
      module: "purchases",
      recordId: "reorder",
      recordLabel: "Kya Mangwana Hai",
      description: `${made} purchase draft bane (${lines.length} qatarein), manzoori ke liye`,
    });
  }
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/products/reorder");

  if (made === 0) return { error: `Purchase nahi bani: ${problems.slice(0, 5).join(" | ")}` };
  return {
    success: true,
    made,
    notice: problems.length ? `Kuch qatarein nahi gayin: ${problems.slice(0, 5).join(" | ")}` : undefined,
  };
}
