"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { payAndPost } from "@/lib/ledger/supplier-money";
import { postGoodsReceived, failed } from "@/lib/ledger/rules";
import { parsePaymentTerms } from "@/lib/purchase-terms";
import { logAudit } from "@/lib/audit";
import { closeHandoff, createHandoff } from "@/lib/work-handoff";
import { requireAction } from "@/lib/access/guard";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
  purchaseId?: string;
  /** Receive ke baad ginti ka khulasa (256). */
  grn?: { received: number; damaged: number; short: number };
  /**
   * Kaam ho gaya, magar ek hissa adhoora reh gaya.
   *
   * `error` se alag: `error` kehta hai "kuch nahi hua", ye kehta hai
   * "ho gaya, magar ye dekh lein". Maal andar aa chuka ho aur sirf
   * ledger ki entry na bani ho -- wahan `error` lautana jhoot hota,
   * kyunki safha wapas jata aur banda dobara receive karne ki koshish
   * karta.
   */
  warning?: string;
}

type PurchaseItemInput = {
  product_id: string;
  quantity: number;
  unit_cost: number;
  batch_number?: string;
  manufacture_date?: string;
  expiry_date?: string;
};

export async function createPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!supplierId) return { error: "Supplier is required." };
  const purchaseDate = String(formData.get("purchase_date") ?? aajKaKhana());
  const notes = (formData.get("notes") as string) || null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const isAdminLevel = profile?.role === "super_admin" || profile?.role === "admin";
  // Manzoori (259): jo khud manzoor karne wala hai us ki purchase seedha
  // approved; baqi staff ki purchase manzoori ke liye jati hai.
  const approver = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";
  let branchId: string | null;
  if (isAdminLevel) {
    branchId = String(formData.get("branch_id") ?? "") || null;
    if (!branchId) return { error: "Branch is required." };
  } else {
    branchId = profile?.branch_id ?? null;
    if (!branchId) return { error: "Your account is not assigned to a branch. Contact admin." };
  }
  let items: PurchaseItemInput[];
  try {
    items = JSON.parse(String(formData.get("items_json") ?? "[]"));
  } catch {
    return { error: "Invalid items data." };
  }
  if (!items || items.length === 0) {
    return { error: "Add at least one product line." };
  }
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  // Adaigi ki shartein (255): poora / kuch / udhaar, aur kab tak.
  const terms = parsePaymentTerms(formData, totalAmount, purchaseDate);
  if ("error" in terms) return { error: terms.error };

  const purchaseNumber = `PO-${Date.now()}`;
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      purchase_number: purchaseNumber,
      supplier_id: supplierId,
      branch_id: branchId,
      purchase_date: purchaseDate,
      status: "pending",
      review_status: approver ? "approved" : "submitted",
      total_amount: totalAmount,
      payment_terms: terms.terms,
      credit_days: terms.creditDays,
      due_date: terms.dueDate,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (purchaseError || !purchase) {
    return { error: purchaseError?.message ?? "Failed to create purchase." };
  }
  if (!approver && user) {
    await supabase.from("purchase_comments").insert({
      purchase_id: purchase.id,
      author_id: user.id,
      kind: "submit",
      body: "Manzoori ke liye bheji",
    });
  }

  // Jo abhi diya wo supplier_payments mein -- wahi jagah jahan har
  // adaigi jati hai (139). Purchase par adad NAHI likha jata; warna
  // ek din do jagah ka adad alag nikalta hai.
  if (terms.paidNow > 0) {
    const paid = await payAndPost(supabase, {
      supplierId,
      purchaseId: purchase.id,
      amount: terms.paidNow,
      paymentDate: purchaseDate,
      paymentMethod: (formData.get("payment_method") as string) || null,
      accountId: String(formData.get("finance_account_id") ?? "").trim() || null,
      notes: `Kharid ${purchaseNumber} ke waqt`,
      branchId,
      createdBy: user?.id ?? null,
      // Purchase ki tareekh khud peeche chuni gayi ho sakti hai -- wo
      // khud wajah hai, alag se kisi se poochne ki zaroorat nahi.
      backdateReason: purchaseDate < aajKaKhana() ? `Purchase ${purchaseNumber} ki apni tareekh (${purchaseDate}) — adaigi bhi usi din ki hai.` : null,
    });
    if ("error" in paid) return { error: `Purchase ban gayi magar: ${paid.error}` };
  }
  for (const item of items) {
    const batchNumber = item.batch_number?.trim() || `${purchaseNumber}-${item.product_id.slice(0, 8)}`;
    const { data: batch, error: batchError } = await supabase
      .from("stock_batches")
      .insert({
        product_id: item.product_id,
        batch_number: batchNumber,
        manufacture_date: item.manufacture_date || null,
        expiry_date: item.expiry_date || null,
        initial_quantity: item.quantity,
      })
      .select("id")
      .single();
    if (batchError || !batch) {
      return { error: `Failed to create batch for a product: ${batchError?.message}` };
    }
    const { error: itemError } = await supabase.from("purchase_items").insert({
      purchase_id: purchase.id,
      product_id: item.product_id,
      batch_id: batch.id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      line_total: item.quantity * item.unit_cost,
    });
    if (itemError) {
      return { error: `Failed to save a purchase line: ${itemError.message}` };
    }
  }
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/bills");
  revalidatePath("/admin/finance");
  return { success: true, purchaseId: purchase.id };
}

/**
 * Maal ginna (256): invoice par 50, aaye 48, toota 1, kam 1.
 *
 * Form se har line ke liye recv_<itemId> aur dmg_<itemId> aate hain;
 * kam = invoice - aaya - toota (database par bhi yehi rok lagi hai).
 * Purane form (sirf purchase_id) par sab kuch invoice jitna maan liya
 * jata hai -- wohi jo pehle hota tha.
 *
 * Stock mein sirf THEEK aaya hua maal jata hai. Toota hua stock mein
 * daal kar phir damaged_out likhna ghalat hoga: us ka paisa hum de hi
 * nahi rahe, to wo hamara nuqsan nahi -- supplier ka hai. Us ka indraj
 * purchase_items.damaged_qty mein rehta hai, v_purchase_discrepancies
 * se nazar aata hai.
 *
 * Dena (139) purchases.total_amount se banta hai, is liye receive par
 * total_amount = aaya x cost; invoice ka asal kul invoice_total mein
 * mehfooz. Farq chhupta nahi.
 */
export async function receivePurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  if (!purchaseId) return { error: "Missing purchase id." };
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status, branch_id, total_amount, invoice_total, review_status, supplier_id, discount_amount, tax_amount, tax_label")
    .eq("id", purchaseId)
    .single();
  if (!purchase) return { error: "Purchase not found." };
  if (purchase.status === "received") return { error: "This purchase is already marked received." };
  if (purchase.status === "cancelled") return { error: "Cancelled purchase receive nahi ho sakti." };
  // Taala database par bhi hai (259); yahan sirf saaf paighaam ke liye.
  if (purchase.review_status !== "approved") {
    return { error: "Ye purchase abhi manzoor nahi hui. Pehle Owner/Admin manzoor karein, phir maal ginein." };
  }
  const { data: items } = await supabase
    .from("purchase_items")
    .select("id, product_id, batch_id, quantity, unit_cost, products(name)")
    .eq("purchase_id", purchaseId);
  if (!items || items.length === 0) return { error: "No items on this purchase." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Purana form (sirf purchase_id) ya naya (har line ka adad)?
  const counted = items.some((i) => formData.has(`recv_${i.id}`));
  const grnNote = String(formData.get("grn_note") ?? "").trim() || null;
  const grnPhotoUrl = String(formData.get("grn_photo_url") ?? "").trim() || null;

  type Counted = {
    id: string;
    product_id: string;
    batch_id: string | null;
    unit_cost: number;
    quantity: number;
    received: number;
    damaged: number;
    short: number;
    note: string | null;
    name: string;
  };
  const rows: Counted[] = [];
  for (const item of items) {
    const rel: any = (item as any).products;
    const name: string = (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? "Product";
    const quantity = Number(item.quantity);
    let received = quantity;
    let damaged = 0;
    let note: string | null = null;
    if (counted) {
      const r = String(formData.get(`recv_${item.id}`) ?? "").trim();
      const d = String(formData.get(`dmg_${item.id}`) ?? "").trim();
      received = r === "" ? 0 : Number(r);
      damaged = d === "" ? 0 : Number(d);
      note = String(formData.get(`note_${item.id}`) ?? "").trim() || null;
      if (!Number.isFinite(received) || received < 0) return { error: `${name}: "theek aaya" ka adad sahi nahi.` };
      if (!Number.isFinite(damaged) || damaged < 0) return { error: `${name}: "toota" ka adad sahi nahi.` };
    }
    const short = quantity - received - damaged;
    if (short < 0) {
      return { error: `${name}: aaya (${received}) + toota (${damaged}) invoice ki tadad (${quantity}) se zyada hai.` };
    }
    rows.push({
      id: item.id,
      product_id: item.product_id,
      batch_id: item.batch_id,
      unit_cost: Number(item.unit_cost),
      quantity,
      received,
      damaged,
      short,
      note,
      name,
    });
  }

  const totalDamaged = rows.reduce((s, r) => s + r.damaged, 0);
  const totalShort = rows.reduce((s, r) => s + r.short, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  if (totalDamaged + totalShort > 0 && !grnNote && !rows.some((r) => r.note)) {
    return { error: "Kuch toota ya kam hai -- note likhein: kya aur kyun. Baad mein supplier se yehi baat hogi." };
  }

  for (const row of rows) {
    // Ginti ke adad pehle likhe jate hain, stock baad mein. Agar rok
    // (received + damaged + short = quantity) yahan tooti to stock
    // chhua hi nahi gaya.
    const { error: lineErr } = await supabase
      .from("purchase_items")
      .update({
        received_qty: row.received,
        damaged_qty: row.damaged,
        short_qty: row.short,
        grn_note: row.note,
        line_total: row.received * row.unit_cost,
      })
      .eq("id", row.id);
    if (lineErr) return { error: `${row.name}: ginti likhi nahi ja saki: ${lineErr.message}` };

    if (row.received <= 0) {
      // Kuch aaya hi nahi: batch khali, stock mein koi harkat nahi.
      if (row.batch_id) {
        await supabase.from("stock_batches").update({ initial_quantity: 0, remaining_quantity: 0, unit_cost: row.unit_cost }).eq("id", row.batch_id);
      }
      continue;
    }

    const { data: product } = await supabase
      .from("products")
      .select("shop_id, branch_id")
      .eq("id", row.product_id)
      .single();

    // Maal kis branch mein jayega, ye is PURCHASE ne khud chuna tha
    // (banate waqt "Branch" khana) -- product ka apna purana branch_id
    // (jab wo pehli dafa bana tha) us faisle se ooncha nahi ho sakta.
    // Pehle ulta tha: product.branch_id hamesha jeet jata, is liye
    // Central Warehouse ke liye banayi purchase bhi product ke purane
    // (Main Branch) mein chali jati thi -- maal "gum" nahi hota tha,
    // bas ghalat jagah dikhta tha (10 September).
    let warehouseId: string | null = null;
    if (product?.shop_id) {
      const { data: shopWarehouse } = await supabase.from("warehouses").select("id").eq("shop_id", product.shop_id).maybeSingle();
      warehouseId = shopWarehouse?.id ?? null;
    }
    if (!warehouseId) {
      const targetBranchId = purchase.branch_id ?? product?.branch_id;
      const { data: mainWarehouse } = await supabase.from("warehouses").select("id").eq("branch_id", targetBranchId ?? "").eq("code", "MAIN").maybeSingle();
      warehouseId = mainWarehouse?.id ?? null;
    }
    if (!warehouseId) {
      return { error: "Is product ki shop/branch ke liye koi warehouse set up nahi hai." };
    }

    if (row.batch_id) {
      await supabase
        .from("stock_batches")
        .update({ warehouse_id: warehouseId, initial_quantity: row.received, remaining_quantity: row.received, unit_cost: row.unit_cost })
        .eq("id", row.batch_id);
    }

    const { data: existingInventory } = await supabase
      .from("inventory")
      .select("id, quantity_on_hand")
      .eq("product_id", row.product_id)
      .eq("warehouse_id", warehouseId)
      .maybeSingle();

    // Ginti yahan se NAHI badalti -- wo neeche wali harkat par trigger
    // karta hai (129). Nayi qatar bhi sifar se banti hai; maal us mein
    // usi harkat se aata hai.
    let inventoryId: string;
    if (existingInventory) {
      inventoryId = existingInventory.id;
    } else {
      const { data: newInventory, error: invError } = await supabase
        .from("inventory")
        .insert({
          product_id: row.product_id,
          warehouse_id: warehouseId,
        })
        .select("id")
        .single();
      if (invError || !newInventory) {
        return { error: `Failed to set up inventory row: ${invError?.message}` };
      }
      inventoryId = newInventory.id;
    }

    const { error: movementError } = await supabase.from("stock_movements").insert({
      inventory_id: inventoryId,
      movement_type: "purchase_in",
      quantity: row.received,
      reference_type: "purchase",
      reference_id: purchaseId,
      notes: row.damaged + row.short > 0 ? `Invoice ${row.quantity}, aaya ${row.received}, toota ${row.damaged}, kam ${row.short}` : null,
      created_by: user?.id ?? null,
    });
    if (movementError) {
      return { error: `Failed to record stock movement: ${movementError.message}` };
    }
  }

  // Dena utne ka jitna theek aaya. Invoice ka asal kul ek dafa mehfooz
  // hota hai (agar bill se pehle hi likha ho to wohi rehta hai).
  const acceptedTotal = rows.reduce((s, r) => s + r.received * r.unit_cost, 0);
  const { error: statusError } = await supabase
    .from("purchases")
    .update({
      status: "received",
      invoice_total: purchase.invoice_total ?? Number(purchase.total_amount ?? 0),
      total_amount: acceptedTotal,
      grn_photo_url: grnPhotoUrl,
      grn_note: grnNote,
      received_at: new Date().toISOString(),
      received_by: user?.id ?? null,
    })
    .eq("id", purchaseId);
  if (statusError) return { error: statusError.message };

  // ===== Cheez ka MAUJOODA hawala rate =====
  //
  // Malik ka usool (4 September): "Agar aaj same product Rs100 purchase
  // rate par aaya aur kal Rs110 par, to current rate Rs110 ho jaye.
  // Lekin purane purchase records Rs110 mein overwrite nahi hone
  // chahiyen."
  //
  // Is liye yahan SIRF cheez ka apna hawala rate badla jata hai. Us
  // purchase ki qatarein, us ka batch, us ka GRN aur us ka hisaab jyun
  // ka tyun rehta hai -- wo us din ki sachchai hai, aur supplier ko us
  // bill par utna hi diya gaya tha.
  //
  // Rate ka source sirf ye raasta hai: MANZOOR SHUDA purchase, aur wohi
  // maal jo waqai andar aaya. Draft bill, AI ka parha hua bill, ya
  // rukka hua/mansookh order -- in mein se kisi se rate nahi charhta.
  // Rate ka ghalat hona baad mein har cheez ka munafa ghalat kar deta
  // hai, aur us ka pata mahinon nahi chalta.
  //
  // Tareekh aur khabar yahan se nahi bhejni parti: wo cheez par lage
  // trigger (293) se khud banti hai, chahe rate kisi bhi raaste se
  // badle.
  for (const row of rows) {
    if (row.received <= 0) continue;
    const { error: rateErr } = await supabase
      .from("products")
      .update({
        purchase_price: row.unit_cost,
        latest_purchase_rate_at: new Date().toISOString(),
        latest_purchase_id: purchaseId,
        latest_supplier_id: purchase.supplier_id ?? null,
      })
      .eq("id", row.product_id);
    // Rate na charh sake to maal wapas nahi hota -- wo andar aa chuka
    // hai. Magar chup bhi nahi raha jata: agla rate purana hi rahega
    // aur us par munafa ghalat ginta rahega.
    if (rateErr) console.error(`rate nahi charha (${row.name}):`, rateErr.message);
  }

  // ===== Ab ledger =====
  //
  // Ye qadam pehle tha hi nahi. 6 September ko Live par nikla ke Rs
  // 112,048 ka maal godam mein para tha, `suppliers.current_payable`
  // bhi theek tha -- magar ledger ko khabar hi nahi thi: khata 1200
  // (Stock) Rs -28 par khara tha aur khata 2000 mein supplier ka naam
  // tak nahi tha.
  //
  // Raqam wo hai jo QABOOL hui (received x unit_cost) -- jo toota ya
  // kam aaya us ka na stock charhta hai na dena banta.
  //
  // Rate trade (kharid) rate hai, sale rate nahi. Malik ka usool:
  // *"supplier se stock aaye ya hum individual transfer karein, wo
  // hamesha trade rate ke hisaab se count ho... jab sale karenge to
  // profit aayega."* Munafa yahin likh dena us din nafa dikhata jis din
  // abhi kuch bika hi nahi.
  //
  // Maal WAPAS nahi hota agar entry na bane -- wo andar aa chuka hai
  // aur ginti likhi ja chuki hai. Magar nakami chhupti bhi nahi: wajah
  // sath jati hai aur qatar `v_ledger_unposted` par surkh dikhti hai.
  let ledgerWarning: string | null = null;
  if (acceptedTotal > 0) {
    // Bill ka discount/tax poore invoice par likha hota hai; agar kuch
    // kam/toota nikla to yahan sirf USI hisse ka discount/tax (388) --
    // poora laga dena galat rehta agar aadha maal wapas ho gaya.
    const originalTotal = Number(purchase.total_amount ?? 0);
    const ratio = originalTotal > 0 ? Math.min(1, acceptedTotal / originalTotal) : 1;
    const posted = await postGoodsReceived({
      purchaseId,
      purchaseNumber: purchase.purchase_number ?? null,
      supplierId: purchase.supplier_id ?? null,
      amount: acceptedTotal,
      discountAmount: purchase.discount_amount != null ? Number(purchase.discount_amount) * ratio : null,
      taxAmount: purchase.tax_amount != null ? Number(purchase.tax_amount) * ratio : null,
      taxLabel: purchase.tax_label,
      ctx: {
        createdBy: user?.id ?? null,
        branchId: purchase.branch_id ?? null,
        claims: [{ table: "purchases", rowId: purchaseId }],
      },
    });
    if (failed(posted)) {
      ledgerWarning = `Maal andar aa gaya, magar ledger tak nahi pahuncha: ${posted.error}`;
      console.error("kharid ledger tak nahi pahunchi:", posted.error);
    }
  }

  // Godam ka kaam yahan khatam hua.
  await closeHandoff("inventory.receiving", "purchases", purchaseId, user?.id ?? null);

  // Ab do kaam aage jate hain, aur dono alag logon ke hain.
  //
  // 1. Jo cheezein andar aayin, un mein se kuch ka SALE RATE nahi hota
  //    -- wo POS par nazar hi nahi aatin. Maal godam mein para rehta
  //    hai aur dukan wala samajhta hai ke stock khatam hai. Is liye
  //    khabar sirf tab jati hai jab waqai koi cheez adhoori ho.
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const { data: adhoore } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds)
    .or("sale_rate_pending.eq.true,selling_price.is.null");

  if ((adhoore ?? []).length > 0) {
    await createHandoff({
      from: "inventory.receiving",
      to: "products.rates_baqi",
      route: "/admin/products/rates-baqi",
      roles: ["warehouse", "manager", "admin", "owner", "super_admin"],
      recordTable: "purchases",
      recordId: purchaseId,
      recordLabel: purchase.purchase_number ?? null,
      branchId: purchase.branch_id ?? null,
      title: `${(adhoore ?? []).length} cheezon ka sale rate baqi hai`,
      message:
        "Maal andar aa gaya, magar jin ka sale rate nahi wo POS par nazar nahi aatin. Rate bharte hi bikne lagengi.",
      byProfileId: user?.id ?? null,
    });
  }

  // 2. Maal aa gaya to dena bhi ban gaya. Adaigi ka faisla Finance ka
  //    kaam hai, godam ka nahi -- is liye ye khabar alag jati hai.
  await createHandoff({
    from: "inventory.receiving",
    to: "purchases.bills",
    route: "/admin/purchases/bills",
    roles: ["finance", "manager", "admin", "owner", "super_admin"],
    recordTable: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number ?? null,
    branchId: purchase.branch_id ?? null,
    title: `Maal aa gaya — ab dena bana`,
    message: `Rs ${Math.round(acceptedTotal).toLocaleString()} ka maal wusool hua. Supplier ka dena ab is raqam ka hai.`,
    byProfileId: user?.id ?? null,
  });

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/bills");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/receiving");
  return {
    success: true,
    grn: { received: totalReceived, damaged: totalDamaged, short: totalShort },
    warning: ledgerWarning ?? undefined,
  };
}

// Delete Purchase - sirf Admin/Owner, reason mandatory. Poori chain
// safely reverse karta hai: stock movements -> inventory -> purchase
// items -> stock batches -> purchase. Bridge AI action-request link
// (agar koi ho) todh deta hai, audit record khud nahi hataya jata.
export async function deletePurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!purchaseId) return { error: "Missing purchase id." };
  if (!reason) return { error: "Delete karne ki wajah likhna zaroori hai." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";
  if (!isUnrestricted) return { error: "Sirf Admin/Owner purchase delete kar sakta hai." };
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number")
    .eq("id", purchaseId)
    .single();
  if (!purchase) return { error: "Purchase not found." };
  await supabase.from("bridge_ai_action_requests").update({ created_purchase_id: null }).eq("created_purchase_id", purchaseId);
  const { data: items } = await supabase
    .from("purchase_items")
    .select("batch_id")
    .eq("purchase_id", purchaseId);
  const batchIds = (items ?? []).map((i) => i.batch_id).filter(Boolean) as string[];
  if (batchIds.length > 0) {
    const { data: fullItems } = await supabase.from("purchase_items").select("product_id, quantity, batch_id").eq("purchase_id", purchaseId);
    for (const item of fullItems ?? []) {
      const { data: batch } = await supabase.from("stock_batches").select("warehouse_id").eq("id", item.batch_id).maybeSingle();
      if (batch?.warehouse_id) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("id, quantity_on_hand")
          .eq("product_id", item.product_id)
          .eq("warehouse_id", batch.warehouse_id)
          .maybeSingle();
        // Ginti yahan se hath se ghatana ab ghalat hoga: neeche jab is
        // kharidari ki harkatein mitai jati hain, trigger khud ginti
        // wapas apni jagah le aata hai (129). Dono karne se maal dugna
        // kam ho jata.
        void inv;
      }
    }
    await supabase.from("stock_movements").delete().eq("reference_type", "purchase").eq("reference_id", purchaseId);
  }
  await supabase.from("purchase_items").delete().eq("purchase_id", purchaseId);
  if (batchIds.length > 0) {
    await supabase.from("stock_batches").delete().in("id", batchIds);
  }
  const { error: deleteError } = await supabase.from("purchases").delete().eq("id", purchaseId);
  if (deleteError) return { error: deleteError.message };
  await logAudit({
    actionType: "delete",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description: `Purchase delete hua. Wajah: ${reason}`,
  });
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/inventory");
  return { success: true };
}

// ---------------------------------------------------------------------
// Manzoori, wapas bhejna, radd, aur baat (259)
// ---------------------------------------------------------------------
const APPROVERS = ["owner", "super_admin", "admin"];

/**
 * Owner/Admin ka faisla: manzoor / wapas / radd. Wapas aur radd par
 * wajah likhna lazmi hai -- bina wajah ke wapas bheji hui cheez par
 * banane wala kya theek kare, use pata hi nahi hota.
 */
export async function reviewPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (!purchaseId) return { error: "Missing purchase id." };
  if (!["approve", "send_back", "reject"].includes(decision)) return { error: "Faisla saaf nahi." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("purchases", "approve");
  if ("error" in guard) return { error: "Purchase manzoor ya wapas sirf Owner/Admin kar sakta hai." };

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status, review_status, branch_id, total_amount")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase not found." };
  if (purchase.status !== "pending") return { error: "Sirf jo purchase abhi receive nahi hui, us par faisla ho sakta hai." };
  if ((decision === "send_back" || decision === "reject") && !comment) {
    return { error: "Wapas bhejne ya radd karne ki wajah likhein -- banane wale ko yehi parhna hai." };
  }

  const update: Record<string, unknown> = {
    review_status: decision === "approve" ? "approved" : decision === "send_back" ? "sent_back" : "rejected",
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };
  if (decision === "reject") update.status = "cancelled";

  const { error } = await supabase.from("purchases").update(update).eq("id", purchaseId);
  if (error) return { error: error.message };

  await supabase.from("purchase_comments").insert({
    purchase_id: purchaseId,
    author_id: user.id,
    kind: decision,
    body: comment || (decision === "approve" ? "Manzoor" : ""),
  });

  await logAudit({
    actionType: "update",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description:
      decision === "approve"
        ? `Purchase manzoor hui${comment ? `: ${comment}` : ""}`
        : decision === "send_back"
          ? `Purchase wapas bheji: ${comment}`
          : `Purchase radd hui: ${comment}`,
  });

  // Manzoori ke baad kaam GODAM ka ho jata hai. Pehle ye baat sirf
  // manzoor karne wale ko maloom hoti thi -- warehouse wala tab tak
  // intezar karta jab tak koi usay phone na kare. Ab khabar khud
  // jati hai: sidebar, dashboard aur ghanti, teenon par.
  if (decision === "approve") {
    await createHandoff({
      from: "purchases",
      to: "inventory.receiving",
      route: "/admin/inventory/receiving",
      roles: ["warehouse", "manager", "admin", "owner", "super_admin"],
      recordTable: "purchases",
      recordId: purchaseId,
      recordLabel: purchase.purchase_number,
      branchId: purchase.branch_id ?? null,
      title: `Kharid manzoor hui — ${purchase.purchase_number}`,
      message: `Ab maal ginna baqi hai. Receiving par "Maal Aa Gaya" karne se hi stock charhega aur supplier ka dena banega.`,
      byProfileId: user.id,
    });
  }

  // Radd ya wapas bheji gayi purchase ka godam wala kaam khatam.
  // Khuli qatar band na karne se sidebar ki ginti barhti rehti hai aur
  // banda us par bharosa karna chhoR deta hai.
  if (decision === "reject") {
    await closeHandoff("inventory.receiving", "purchases", purchaseId, user.id);
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/bills");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/inventory/receiving");
  return { success: true };
}

/**
 * Tasdeeq -- Branch Manager ka kaam, sirf apni branch ki hadd tak (372,
 * Kharche 364 / Stock Count 370 wala tareeqa). Final manzoori nahi
 * badalti -- sirf agla marhala kholta hai. `reviewPurchase` hi asal
 * approve/send_back/reject karta hai, tasdeeq ke baghair bhi.
 */
export async function verifyPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  if (!purchaseId) return { error: "Missing purchase id." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("purchases", "verify");
  if ("error" in guard) return { error: guard.error };
  const { caller } = guard;

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status, review_status, branch_id, created_by")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase not found." };
  if (purchase.status !== "pending" || purchase.review_status !== "submitted") {
    return { error: "Ye ab tasdeeq ke marhale mein nahi hai (pehle hi tasdeeq/manzoor/wapas/radd ho chuka)." };
  }

  if (!caller.unrestricted && caller.scope !== "all") {
    if (!caller.branchId || purchase.branch_id !== caller.branchId) {
      return { error: "Ye purchase aapki branch ki nahi hai — sirf apni branch ki tasdeeq kar sakte hain." };
    }
  }
  if (purchase.created_by === user.id) {
    return { error: "Apni banayi hui purchase khud tasdeeq nahi kar sakte — doosra authorized banda kare." };
  }

  const { error } = await supabase
    .from("purchases")
    .update({ review_status: "verified", verified_by: user.id, verified_at: new Date().toISOString() })
    .eq("id", purchaseId);
  if (error) return { error: error.message };

  await supabase.from("purchase_comments").insert({
    purchase_id: purchaseId,
    author_id: user.id,
    kind: "verify",
    body: "Tasdeeq",
  });

  await logAudit({
    actionType: "verify",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description: "Branch Manager ki tasdeeq — ab Owner/Admin ki final manzoori ka intezar.",
  });

  revalidatePath("/admin/purchases");
  return { success: true, message: "Tasdeeq ho gayi — ab final manzoori ka intezar hai." };
}

/**
 * Review ke doran line (quantity/rate) mein ghalti nazar aaye to yahin
 * theek ho jaye (259 ke aage, malik 7 September): *"agar approval deni
 * hai to products ko view to karna chahiye... kisi ka rate to nahi
 * ghalat... jo edit kiya wo trackable hona chahiye."*
 *
 * Sirf jab tak maal receive NAHI hua -- receive hote hi stock aur
 * ledger isi purchase ke adad se ban jate hain, us ke baad line badalna
 * un donon ko asal se alag kar deta. Is liye rok wohi hai jo
 * `reviewPurchase` mein bhi hai.
 *
 * Har badlaav DO jagah jata hai: audit log (jaisa har jagah) aur isi
 * purchase ki apni baat ki fehrist (`purchase_comments`, kind='edit') --
 * taake jo bhi is purchase ko review kare, usay doosra safha khole
 * baghair saaf nazar aaye ke kya badla.
 */
export async function updatePurchaseItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const itemId = String(formData.get("item_id") ?? "");
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? "");
  const unitCost = Number(formData.get("unit_cost") ?? "");
  if (!itemId || !purchaseId) return { error: "Missing item id." };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Quantity sahi likhein." };
  if (!Number.isFinite(unitCost) || unitCost <= 0) return { error: "Rate sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !APPROVERS.includes(me.role)) {
    return { error: "Purchase ki line sirf Owner/Admin edit kar sakta hai." };
  }

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase not found." };
  if (purchase.status !== "pending") {
    return { error: "Sirf jo purchase abhi receive nahi hui, us ki line badli ja sakti hai." };
  }

  const { data: item } = await supabase
    .from("purchase_items")
    .select("id, quantity, unit_cost, products(name)")
    .eq("id", itemId)
    .eq("purchase_id", purchaseId)
    .maybeSingle();
  if (!item) return { error: "Line not found." };
  const rel: any = (item as any).products;
  const productName: string = (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? "Product";

  const oldQuantity = Number(item.quantity);
  const oldUnitCost = Number(item.unit_cost);
  if (oldQuantity === quantity && oldUnitCost === unitCost) return { success: true };

  const { error: itemErr } = await supabase
    .from("purchase_items")
    .update({ quantity, unit_cost: unitCost, line_total: quantity * unitCost })
    .eq("id", itemId);
  if (itemErr) return { error: itemErr.message };

  // Purchase ka total isi purchase ki SAB lines se dobara gina jata hai
  // -- sirf is line ka farq jama karna kisi din rounding se alag ho
  // sakta tha.
  const { data: allItems } = await supabase.from("purchase_items").select("quantity, unit_cost").eq("purchase_id", purchaseId);
  const newTotal = (allItems ?? []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0);
  await supabase.from("purchases").update({ total_amount: newTotal }).eq("id", purchaseId);

  const changes: string[] = [];
  if (oldQuantity !== quantity) changes.push(`quantity ${oldQuantity} → ${quantity}`);
  if (oldUnitCost !== unitCost) changes.push(`rate Rs ${oldUnitCost} → Rs ${unitCost}`);
  const body = `${productName}: ${changes.join(", ")}`;

  await supabase.from("purchase_comments").insert({
    purchase_id: purchaseId,
    author_id: user.id,
    kind: "edit",
    body,
  });

  await logAudit({
    actionType: "update",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description: `Review ke doran line badli gayi: ${body}`,
    changes: {
      quantity: { pehle: oldQuantity, ab: quantity },
      unit_cost: { pehle: oldUnitCost, ab: unitCost },
    },
  });

  revalidatePath("/admin/purchases");
  return { success: true };
}

/**
 * Banane wale ka jawab: baat likhna, aur wapas aayi purchase ko dobara
 * manzoori ke liye bhejna. Koi bhi staff baat likh sakta hai; dobara
 * bhejne ke liye jawab lazmi hai.
 */
export async function commentPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const resubmit = String(formData.get("resubmit") ?? "") === "1";
  const comment = String(formData.get("comment") ?? "").trim();
  if (!purchaseId) return { error: "Missing purchase id." };
  if (!comment) return { error: "Kuch likhein to sahi." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status, review_status")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase not found." };

  if (resubmit) {
    if (purchase.status !== "pending" || purchase.review_status !== "sent_back") {
      return { error: "Sirf wapas aayi hui purchase dobara bheji ja sakti hai." };
    }
    // Tasdeeq bhi saaf -- content badal chuki, purani tasdeeq ab us par
    // nahi lagti. Manager ko dobara dekhna hoga.
    const { error } = await supabase
      .from("purchases")
      .update({ review_status: "submitted", reviewed_by: null, reviewed_at: null, verified_by: null, verified_at: null })
      .eq("id", purchaseId);
    if (error) return { error: error.message };
  }

  const { error: cErr } = await supabase.from("purchase_comments").insert({
    purchase_id: purchaseId,
    author_id: user.id,
    kind: resubmit ? "resubmit" : "comment",
    body: comment,
  });
  if (cErr) return { error: cErr.message };

  revalidatePath("/admin/purchases");
  return { success: true };
}
