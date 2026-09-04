import { Type, type FunctionDeclaration } from "@google/genai";
import { decideMatch } from "@/lib/product-match";
import type { createClient } from "@/lib/supabase/server";
import { getInventoryValue } from "@/lib/utils/inventory-value";

// ===== Tool 1: Financial Summary =====
async function getFinancialSummary(supabase: ReturnType<typeof createClient>) {
  const { data: bankAccounts } = await supabase
    .from("finance_accounts")
    .select("current_balance")
    .eq("is_active", true)
    .eq("account_type", "bank");
  const bankBalance = (bankAccounts ?? []).reduce((s, a) => s + Number(a.current_balance), 0);

  const { data: creditTxns } = await supabase
    .from("branch_credit_transactions")
    .select("transaction_type, amount");
  let totalReceivables = 0;
  (creditTxns ?? []).forEach((t: any) => {
    const amt = Number(t.amount);
    if (t.transaction_type === "order_charge") totalReceivables += amt;
    else if (t.transaction_type === "advance_payment") totalReceivables -= amt;
  });
  totalReceivables = Math.max(0, totalReceivables);

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("current_payable")
    .gt("current_payable", 0);
  const totalPayables = (suppliers ?? []).reduce((s, sup) => s + Number(sup.current_payable ?? 0), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const { data: monthExpenses } = await supabase
    .from("company_expense_requests")
    .select("amount")
    .eq("status", "approved")
    .gte("approved_at", monthStart);
  const expensesThisMonth = (monthExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return { bankBalance, totalReceivables, totalPayables, expensesThisMonth, currency: "PKR" };
}

// ===== Tool 2: Inventory Summary (reuses the shared inventory-value helper) =====
async function getInventorySummary(supabase: ReturnType<typeof createClient>) {
  const { totalValue, byCategory } = await getInventoryValue(supabase);
  const { data: productsData } = await supabase
    .from("products")
    .select("id, name, min_stock_threshold")
    .eq("is_deleted", false)
    .gt("min_stock_threshold", 0);
  const { data: inventoryRows } = await supabase
    .from("inventory")
    .select("product_id, quantity_on_hand");
  const stockByProduct = new Map<string, number>();
  (inventoryRows ?? []).forEach((row) => {
    const cur = stockByProduct.get(row.product_id) ?? 0;
    stockByProduct.set(row.product_id, cur + Number(row.quantity_on_hand ?? 0));
  });
  const lowStockProductNames = (productsData ?? [])
    .filter((p) => (stockByProduct.get(p.id) ?? 0) <= Number(p.min_stock_threshold))
    .map((p) => p.name);
  return { totalStockValue: totalValue, valueByCategory: byCategory, lowStockProductNames, currency: "PKR" };
}

// ===== Tool 3: Sales Summary (last 30 din, growth, branch-wise, payment-mode-wise) =====
async function getSalesSummary(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const last30Start = new Date(now);
  last30Start.setDate(last30Start.getDate() - 30);
  const prev30Start = new Date(now);
  prev30Start.setDate(prev30Start.getDate() - 60);

  const { data: sales } = await supabase
    .from("pos_sales")
    .select("total_amount, payment_mode, created_at, branch_id, branches(name)")
    .gte("created_at", prev30Start.toISOString())
    .lte("created_at", now.toISOString());

  let totalSalesLast30 = 0;
  let totalSalesPrevious30 = 0;
  let countLast30 = 0;
  const branchTotals = new Map<string, number>();
  const byPaymentMode: Record<string, number> = { cash: 0, khata: 0, split: 0, bank: 0, kisan_card: 0 };

  (sales ?? []).forEach((s: any) => {
    const amount = Number(s.total_amount ?? 0);
    const createdAt = new Date(s.created_at);
    const branch = Array.isArray(s.branches) ? s.branches[0] : s.branches;
    const branchName = branch?.name ?? "Unknown";
    if (createdAt >= last30Start) {
      totalSalesLast30 += amount;
      countLast30 += 1;
      branchTotals.set(branchName, (branchTotals.get(branchName) ?? 0) + amount);
      if (byPaymentMode[s.payment_mode] !== undefined) byPaymentMode[s.payment_mode] += amount;
    } else {
      totalSalesPrevious30 += amount;
    }
  });

  const growthPercent =
    totalSalesPrevious30 > 0
      ? Number((((totalSalesLast30 - totalSalesPrevious30) / totalSalesPrevious30) * 100).toFixed(1))
      : null;

  const branchPerformance = Array.from(branchTotals.entries())
    .map(([name, total]) => ({ branchName: name, totalSales: total }))
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 5);

  return {
    totalSalesLast30Days: totalSalesLast30,
    totalSalesPrevious30Days: totalSalesPrevious30,
    growthPercentVsPreviousPeriod: growthPercent,
    transactionCountLast30Days: countLast30,
    topBranchesByLast30Days: branchPerformance,
    byPaymentModeLast30Days: byPaymentMode,
    currency: "PKR",
  };
}

// ===== Tool 4: Farmer Credit Summary (Kisan Khata) =====
async function getFarmerCreditSummary(supabase: ReturnType<typeof createClient>) {
  const { data: balances } = await supabase
    .from("farmer_credit_balances")
    .select("farmer_id, full_name, farmer_code, balance_due")
    .order("balance_due", { ascending: false });
  const withCredit = (balances ?? []).filter((b: any) => Number(b.balance_due) > 0);
  const totalOutstandingCredit = withCredit.reduce((s: number, b: any) => s + Number(b.balance_due), 0);
  const topFarmersByBalance = withCredit.slice(0, 5).map((b: any) => ({
    farmerName: b.full_name,
    farmerCode: b.farmer_code,
    balanceDue: Number(b.balance_due),
  }));
  return {
    totalOutstandingCredit,
    farmersWithCreditCount: withCredit.length,
    topFarmersByBalance,
    currency: "PKR",
  };
}

// ===== Tool 5: Propose Action (AI kabhi seedha kuch nahi karta - sirf propose karta hai, admin approve karega) =====
async function proposeAction(
  supabase: ReturnType<typeof createClient>,
  args: { action_type?: string; description?: string; details?: string; product_name?: string; suggested_quantity?: number }
) {
  const { data: settings } = await supabase
    .from("bridge_ai_settings")
    .select("actions_enabled")
    .eq("id", true)
    .single();
  if (!settings?.actions_enabled) {
    return {
      proposed: false,
      message: "Action proposals abhi band hain - admin ne ye feature disable kar rakha hai.",
    };
  }
  if (!args.description) {
    return { proposed: false, message: "Description zaroori hai proposal ke liye." };
  }

  let productId: string | null = null;
  if (args.product_name) {
    const { data: matchedProduct } = await supabase
      .from("products")
      .select("id")
      .eq("is_deleted", false)
      .ilike("name", `%${args.product_name}%`)
      .limit(1)
      .maybeSingle();
    productId = matchedProduct?.id ?? null;
  }

  const { data, error } = await supabase
    .from("bridge_ai_action_requests")
    .insert({
      action_type: args.action_type ?? "general",
      description: args.description,
      details: args.details ?? null,
      status: "pending",
      product_id: productId,
      suggested_quantity: args.suggested_quantity ?? null,
    })
    .select("id")
    .single();
  if (error) {
    return { proposed: false, message: "Proposal save nahi ho saka: " + error.message };
  }
  return {
    proposed: true,
    requestId: data.id,
    message: "Proposal admin ke review ke liye bhej di gayi hai. Koi bhi change abhi tak nahi hua - admin approve karega tab hoga.",
  };
}

// ===== Tool 6: Milk Summary (Livestock/Dairy Agent) =====
async function getMilkSummary(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const last7Start = new Date(now);
  last7Start.setDate(last7Start.getDate() - 7);

  const { data: entries } = await supabase
    .from("milk_entries")
    .select("quantity_liters, total_amount, entry_date")
    .gte("entry_date", last7Start.toISOString().slice(0, 10));

  const totalLitersLast7Days = (entries ?? []).reduce((s, e) => s + Number(e.quantity_liters), 0);
  const totalValueLast7Days = (entries ?? []).reduce((s, e) => s + Number(e.total_amount), 0);

  const { data: unpaidBalances } = await supabase.from("milk_farmer_balances").select("balance_due").gt("balance_due", 0);
  const totalUnpaidToFarmers = (unpaidBalances ?? []).reduce((s, b) => s + Number(b.balance_due), 0);

  return {
    totalLitersLast7Days,
    totalValueLast7Days,
    farmersWithUnpaidBalanceCount: (unpaidBalances ?? []).length,
    totalUnpaidToFarmers,
    currency: "PKR",
  };
}

// ===== Tool 7: Grain Procurement Summary (Crop Agent) =====
async function getGrainSummary(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const last30Start = new Date(now);
  last30Start.setDate(last30Start.getDate() - 30);

  const { data: entries } = await supabase
    .from("grain_procurement_entries")
    .select("grain_type, weight_kg, total_amount, entry_date")
    .gte("entry_date", last30Start.toISOString().slice(0, 10));

  const byGrainType: Record<string, { totalKg: number; totalValue: number }> = {};
  (entries ?? []).forEach((e: any) => {
    if (!byGrainType[e.grain_type]) byGrainType[e.grain_type] = { totalKg: 0, totalValue: 0 };
    byGrainType[e.grain_type].totalKg += Number(e.weight_kg);
    byGrainType[e.grain_type].totalValue += Number(e.total_amount);
  });

  const { data: payments } = await supabase
    .from("grain_procurement_payments")
    .select("amount")
    .gte("created_at", last30Start.toISOString());
  const totalPaidLast30Days = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return { byGrainTypeLast30Days: byGrainType, totalPaidToSellersLast30Days: totalPaidLast30Days, currency: "PKR" };
}

// ===== Tool 8: Machinery Rental Summary (equipment) =====
async function getMachinerySummary(supabase: ReturnType<typeof createClient>) {
  const { data: bookings } = await supabase
    .from("machinery_bookings")
    .select("status, total_amount, commission_amount, amount_received_from_farmer");

  const totalBookingsValue = (bookings ?? []).reduce((s, b) => s + Number(b.total_amount), 0);
  const totalCommissionEarned = (bookings ?? []).reduce((s, b) => s + Number(b.commission_amount), 0);
  const outstandingFromFarmers = (bookings ?? []).reduce(
    (s, b) => s + (Number(b.total_amount) - Number(b.amount_received_from_farmer)),
    0
  );
  const pendingBookingsCount = (bookings ?? []).filter((b) => b.status === "pending").length;

  return {
    totalBookingsValue,
    totalCommissionEarned,
    outstandingFromFarmers,
    pendingBookingsCount,
    currency: "PKR",
  };
}

// ===== Tool 9: Broadcast to Farmers (Announcement ya Individual WhatsApp Message) =====
async function broadcastToFarmers(
  supabase: ReturnType<typeof createClient>,
  args: { title?: string; message?: string; target?: string; farmer_phone?: string }
) {
  if (!args.title || !args.message) {
    return { sent: false, message: "Title aur Message dono zaroori hain." };
  }

  if (args.target === "specific" && args.farmer_phone) {
    const { data: farmer } = await supabase
      .from("farmers")
      .select("whatsapp_number, phone_number")
      .or(`whatsapp_number.eq.${args.farmer_phone},phone_number.eq.${args.farmer_phone}`)
      .maybeSingle();
    if (!farmer) return { sent: false, message: "Ye Farmer number database mein nahi mila." };

    const { sendWhatsAppMessage } = await import("@/lib/whatsapp-client");
    const targetNumber = farmer.whatsapp_number ?? farmer.phone_number;
    if (!targetNumber) return { sent: false, message: "Is farmer ka koi number darj nahi hai." };
    // AI ko sach batana yahan aur bhi zaroori hai: wo apne jawab mein
    // wahi likhta hai jo yahan se milta hai, aur "bhej diya gaya" keh
    // dena banda us par bharosa kar ke aage barh jata hai.
    try {
      await sendWhatsAppMessage(targetNumber, `${args.title}\n\n${args.message}`);
    } catch (e) {
      return { sent: false, message: `WhatsApp message nahi ja saka: ${e instanceof Error ? e.message : "wajah maloom nahi"}` };
    }
    return { sent: true, message: `WhatsApp message ${targetNumber} ko bhej diya gaya.` };
  }

  const { error } = await supabase.from("announcements").insert({
    title: args.title,
    message: args.message,
    cta_type: "none",
    is_active: true,
  });
  if (error) return { sent: false, message: "Announcement banane mein masla hua: " + error.message };

  return { sent: true, message: "Announcement ban gayi hai - sab Farmers ko unke agle Portal Login pe dikhegi." };
}

// ===== Tool 10: Shop order ka DRAFT (260) =====
// "Mahabali ke liye DAP 20, Urea 30" -> agri_orders mein draft. Shop aur
// product database se milte hain; jo na mile ya do mil jayen, wahan
// order NAHI banta -- wapas poochha jata hai. Draft ordering ki chain
// mein tab jata hai jab koi banda action-requests par manzoor kare. AI
// khud kabhi 'submitted' nahi karta, rate khud nahi banata (thok rate
// product par jo hai wohi; na ho to wo line nahi charhti).
async function draftShopOrder(
  supabase: ReturnType<typeof createClient>,
  args: {
    shop_name?: string;
    items?: { product_name?: string; qty?: number }[];
    payment_terms?: string;
    notes?: string;
  }
) {
  const { data: settings } = await supabase
    .from("bridge_ai_settings")
    .select("actions_enabled")
    .eq("id", true)
    .single();
  if (!settings?.actions_enabled) {
    return { created: false, message: "Action proposals abhi band hain - admin ne ye feature disable kar rakha hai." };
  }
  const shopName = (args.shop_name ?? "").trim();
  const items = (args.items ?? []).filter((i) => i && i.product_name && Number(i.qty) > 0);
  if (!shopName) return { created: false, message: "Kis shop/branch ke liye order hai, wo naam chahiye." };
  if (items.length === 0) return { created: false, message: "Kam az kam ek product aur us ki tadad chahiye." };

  // Shop: naam se milan. Main branch ko order nahi hota -- wo bhejne wala hai.
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, is_main_branch")
    .eq("is_active", true)
    .ilike("name", `%${shopName}%`);
  const shops = (branches ?? []).filter((b) => !b.is_main_branch);
  if (shops.length === 0) {
    const { data: all } = await supabase.from("branches").select("name").eq("is_active", true).eq("is_main_branch", false).order("name").limit(20);
    return {
      created: false,
      message: `"${shopName}" naam ki koi shop/branch nahi mili.`,
      available_shops: (all ?? []).map((b) => b.name),
    };
  }
  if (shops.length > 1) {
    return { created: false, message: `"${shopName}" se ek se zyada shops milti hain -- kaun si?`, candidates: shops.map((b) => b.name) };
  }
  const shop = shops[0];

  // Products: ek ek naam. Do milen to poochho; rate na ho to line nahi.
  const { data: catalogueRows } = await supabase
    .from("products")
    .select("id, name, pack_size, selling_price, wholesale_price, sale_rate_pending")
    .eq("is_deleted", false)
    .limit(5000);
  const catalogue = catalogueRows ?? [];
  const matched: { product_id: string; product_name: string; pack_size: string | null; unit_price: number; order_qty: number }[] = [];
  const problems: { product_name: string; problem: string; candidates?: string[] }[] = [];
  for (const it of items) {
    const name = String(it.product_name).trim();
    // Score ke sath milaan (H): bilkul wohi ya saaf aage wala lagta
    // hai; do barabar hon ya score kam ho to poochha jata hai.
    const d = decideMatch(name, null, catalogue);
    if (d.kind === "none") {
      if (d.candidates.length === 0) problems.push({ product_name: name, problem: "nahi mila" });
      else
        problems.push({
          product_name: name,
          problem: "saaf nahi kaun sa -- in mein se kaun sa?",
          candidates: d.candidates.map((c) => `${c.item.name}${c.item.pack_size ? ` (${c.item.pack_size})` : ""} ~${Math.round(c.score * 100)}%`),
        });
      continue;
    }
    const pick = d.item;
    // Thok rate branch ka rate hai; na ho to sale rate. Sale rate bhi
    // baqi ho to is line ka koi rate nahi -- 0 likhna jhoot hota.
    const unit = pick.wholesale_price != null ? Number(pick.wholesale_price) : pick.sale_rate_pending ? null : Number(pick.selling_price);
    if (unit == null || unit <= 0) {
      problems.push({ product_name: pick.name, problem: "rate baqi hai -- pehle Adhoore Products par rate bharein" });
      continue;
    }
    matched.push({ product_id: pick.id, product_name: pick.name, pack_size: pick.pack_size, unit_price: unit, order_qty: Number(it.qty) });
  }
  if (problems.length > 0) {
    return { created: false, message: "Kuch products par order nahi ban sakta -- pehle ye saaf karein.", problems, matched: matched.map((m) => `${m.product_name} x ${m.order_qty}`) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Order number: wohi ginti jo haath se banaye order par chalti hai.
  const { createServiceClient } = await import("@/lib/supabase/service");
  const svc = createServiceClient();
  const year = new Date().getFullYear() % 100;
  const { data: counter } = await svc.from("agri_order_counters").select("last_number").eq("year", year).maybeSingle();
  const next = (counter?.last_number ?? 0) + 1;
  if (counter) await svc.from("agri_order_counters").update({ last_number: next }).eq("year", year);
  else await svc.from("agri_order_counters").insert({ year, last_number: next });
  const orderNumber = `AGR-${year}-${String(next).padStart(5, "0")}`;

  const subtotal = matched.reduce((s, m) => s + m.order_qty * m.unit_price, 0);
  const paymentTerms = args.payment_terms === "Advance Payment" ? "Advance Payment" : "Credit";

  const { data: order, error } = await supabase
    .from("agri_orders")
    .insert({
      order_number: orderNumber,
      order_type: "FMCG / Other",
      order_from: "AgriBridge Company",
      order_to_type: "Branch",
      order_to_branch_id: shop.id,
      shop_dealer_name: shop.name,
      subtotal,
      discount: 0,
      tax: 0,
      freight_charges: 0,
      other_charges: 0,
      grand_total: subtotal,
      payment_terms: paymentTerms,
      credit_limit: 0,
      existing_outstanding: 0,
      available_credit: 0,
      projected_outstanding: subtotal,
      // DRAFT: chain mein nahi. Manzoori par submitted hota hai.
      status: "draft",
      requested_by: user?.id ?? null,
      notes: `Bridge AI ka draft${args.notes ? `: ${args.notes}` : ""}`,
    })
    .select("id")
    .single();
  if (error || !order) return { created: false, message: `Draft nahi ban saka: ${error?.message ?? "wajah maloom nahi"}` };

  const { error: itemsErr } = await supabase.from("agri_order_items").insert(
    matched.map((m) => ({
      order_id: order.id,
      product_id: m.product_id,
      product_name: m.product_name,
      pack_size: m.pack_size,
      order_qty: m.order_qty,
      unit_price: m.unit_price,
      discount: 0,
      tax: 0,
      net_price: m.unit_price,
      line_total: m.order_qty * m.unit_price,
    }))
  );
  if (itemsErr) return { created: false, message: `Draft bana magar lines nahi charhin: ${itemsErr.message}` };

  await supabase.from("agri_order_timeline").insert({ order_id: order.id, status: "draft", note: `Bridge AI ne draft banaya - ${orderNumber}`, created_by: user?.id ?? null });

  const lines = matched.map((m) => `${m.product_name} x ${m.order_qty} @ Rs ${m.unit_price}`).join(", ");
  await supabase.from("bridge_ai_action_requests").insert({
    action_type: "order_draft",
    description: `${shop.name} ke liye order draft ${orderNumber}: ${lines}`,
    details: args.notes ?? null,
    status: "pending",
    created_order_id: order.id,
  });

  return {
    created: true,
    order_number: orderNumber,
    shop: shop.name,
    lines: matched.map((m) => ({ product: m.product_name, qty: m.order_qty, unit_price: m.unit_price })),
    total: subtotal,
    currency: "PKR",
    message: `Draft ${orderNumber} ban gaya (Rs ${subtotal.toLocaleString()}). Ye abhi order NAHI hai -- /admin/bridge-ai/action-requests par manzoor hone ke baad Sales ke paas jayega.`,
  };
}

// ===== Tool 11: Kya mangwana hai (262) =====
// Bikri ki raftaar se: kitne din ka stock, kitna mangwayein. Sirf
// parhta hai -- purchase banana safhe se ya draft_shop_order/propose se.
async function getReorderSuggestions(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("v_reorder_suggestions")
    .select("name, pack_size, sold_30, on_hand, daily_rate, days_cover, suggested_qty, urgency, last_supplier_name, last_unit_cost")
    .order("urgency")
    .order("days_cover", { ascending: true, nullsFirst: false })
    .limit(20);
  const rows = (data ?? []).map((r) => ({
    product: `${r.name}${r.pack_size ? ` (${r.pack_size})` : ""}`,
    sold_last_30_days: Number(r.sold_30 ?? 0),
    in_stock: Number(r.on_hand ?? 0),
    // Bikri sifar ho to din ka hisaab NULL -- "hisaab nahi banta", sifar nahi.
    days_of_stock_left: r.days_cover == null ? null : Number(r.days_cover),
    suggested_order_qty: Number(r.suggested_qty ?? 0),
    urgency: r.urgency,
    last_supplier: r.last_supplier_name,
    last_unit_cost: r.last_unit_cost == null ? null : Number(r.last_unit_cost),
  }));
  return {
    rule: "roz ki bikri = 30 din ki bikri / 30; mangwana = roz ki bikri x (7 din raasta + 14 din stock) - jo para hai",
    count: rows.length,
    items: rows,
    page: "/admin/products/reorder",
    currency: "PKR",
  };
}

// ===== Gemini ko batata hai har tool kya karta hai =====
export const bridgeToolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_financial_summary",
    description:
      "Business ka financial summary deta hai: bank balance, receivables (farmers/branches se lena hai), payables (suppliers ko dena hai), aur is mahine ke approved company expenses.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_inventory_summary",
    description:
      "Inventory/stock ka summary deta hai: total stock value, category-wise value breakdown, aur jo products low-stock hain unke naam.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_sales_summary",
    description:
      "Sales ka summary deta hai: pichle 30 din ka total sales, uska pichle 30 din se growth percent, transaction count, top-performing branches, aur payment-mode-wise breakdown (cash/khata/split/bank/kisan card).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_farmer_credit_summary",
    description:
      "Farmer credit (Kisan Khata) ka summary deta hai: total outstanding credit jo farmers par hai, kitne farmers par credit balance hai, aur top 5 sabse zyada balance wale farmers unke naam aur amount ke sath.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_milk_summary",
    description:
      "Milk collection ka summary deta hai: pichle 7 din ka total liters aur value, aur farmers ko kitna paisa Milk ka dena baaqi hai (unpaid balance).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_grain_summary",
    description:
      "Grain Procurement ka summary deta hai: pichle 30 din mein har Grain Type (wheat/rice/maize) ka total kg aur value, aur sellers ko kitna paisa diya gaya.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_machinery_summary",
    description:
      "Machinery Rental ka summary deta hai: total bookings value, kamaya hua commission, farmers se baaqi paisa, aur kitni bookings pending hain.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_reorder_suggestions",
    description:
      "Kya mangwana chahiye: pichhle 30 din ki bikri ki raftaar se har product ka kitne din ka stock baqi hai aur kitna mangwana chahiye (7 din raasta + 14 din ka stock). Jab user pooche 'kya mangwana hai', 'kaun si cheez khatam ho rahi hai', 'stock kitne din chalega'.",
  },
  {
    name: "get_supplier_dues",
    description:
      "Supplier ko kitna dena hai: har supplier ka baqi, jin ki tareekh guzar chuki (overdue) aur jo agle N din mein deni hain. Naam diya jaye to sirf usi supplier ka. Jab user pooche 'ABC ko kitne dene hain', 'kis supplier ki adaigi baqi hai', 'agle 7 din mein kitni adaigi hai', 'kaun si payment overdue hai'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        supplier_name: {
          type: Type.STRING,
          description: "Supplier ka naam ya us ka hissa. Khali chhoR dein to sab suppliers.",
        },
        days: {
          type: Type.NUMBER,
          description: "Agle kitne din ki adaigi dekhni hai (default 7).",
        },
      },
    },
  },
  {
    name: "propose_action",
    description:
      "Jab user AI se koi kaam karne ko kahe jo database change kare (jaise purchase order banana, task banana, ya kisi cheez ki sifarish), to ye tool use karein. Ye seedha koi change nahi karta - sirf ek proposal banata hai jo admin ko review/approve karna hoga. Agar ye ek purchase/stock-order type ki sifarish hai, to product_name aur suggested_quantity bhi zaroor bhrein taake admin approve karte waqt seedha purchase order bana sake.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action_type: {
          type: Type.STRING,
          description: "Chhota label action ke type ke liye, jaise 'purchase_recommendation', 'task', 'follow_up'",
        },
        description: {
          type: Type.STRING,
          description: "Ek line mein saaf tor par bataein kya propose kiya ja raha hai (Roman Urdu mein)",
        },
        details: {
          type: Type.STRING,
          description: "Extra detail ya reasoning (Roman Urdu mein), optional",
        },
        product_name: {
          type: Type.STRING,
          description: "Agar ye purchase recommendation hai, to product ka naam (jaise 'Sona Urea') - system database mein match karne ki koshish karega",
        },
        suggested_quantity: {
          type: Type.NUMBER,
          description: "Agar ye purchase recommendation hai, to sifarish ki gayi quantity (sirf number, jaise 200)",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "draft_shop_order",
    description:
      "Kisi shop/branch ke liye stock order ka DRAFT banata hai (jaise 'Mahabali ke liye DAP 20 aur Urea 30'). Sirf draft -- asal order tab banta hai jab admin action-requests par manzoor kare. Shop aur product ka naam database se milaya jata hai; na mile ya kai milen to draft nahi banta aur wapas poochna hota hai. Rate khud mat likhein, system product ka thok rate lagata hai.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        shop_name: { type: Type.STRING, description: "Shop/branch ka naam jis ke liye maal chahiye (jaise 'Mahabali')" },
        items: {
          type: Type.ARRAY,
          description: "Products aur tadad",
          items: {
            type: Type.OBJECT,
            properties: {
              product_name: { type: Type.STRING, description: "Product ka naam jaisa user ne kaha (jaise 'DAP')" },
              qty: { type: Type.NUMBER, description: "Tadad (sirf number)" },
            },
            required: ["product_name", "qty"],
          },
        },
        payment_terms: { type: Type.STRING, description: "'Credit' (khata, default) ya 'Advance Payment'" },
        notes: { type: Type.STRING, description: "Koi note (Roman Urdu), optional" },
      },
      required: ["shop_name", "items"],
    },
  },
  {
    name: "broadcast_to_farmers",
    description:
      "Jab user chahe ke saare Farmers ko ek Announcement/Message bheja jaye (jaise Naya Feature ka Elaan), ya kisi ek specific Farmer ko Reward/Individual Message bheji jaye, to ye tool use karein. 'target' ko 'all' rakhein sab Farmers ke liye (Announcement banega, unke Portal Login pe dikhega), ya 'specific' rakhein aur 'farmer_phone' dein ek Farmer ko seedha WhatsApp bhejne ke liye.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Announcement/Message ka Title" },
        message: { type: Type.STRING, description: "Poora Message (Roman Urdu mein)" },
        target: { type: Type.STRING, description: "'all' ya 'specific'" },
        farmer_phone: { type: Type.STRING, description: "Agar target 'specific' hai, to us Farmer ka Phone/WhatsApp Number" },
      },
      required: ["title", "message", "target"],
    },
  },
];

// ===== API route isi ek function ko call karega =====

/**
 * Supplier ko kitna dena hai.
 *
 * Ye adad kisi jagah haath se nahi likha jata: `v_supplier_due_calendar`
 * received purchases mein se adaigiyan minus kar ke banata hai -- wohi
 * hisaab jo /admin/purchases/bills par nazar aata hai. AI apna alag
 * hisaab nahi lagata, warna do jagah do adad ho jate.
 *
 * Ginti na mile to `null` -- sifar NAHI. Sifar kehta hai "dena kuch
 * nahi"; ye us se bilkul alag baat hai.
 */
async function getSupplierDues(
  supabase: ReturnType<typeof createClient>,
  args: Record<string, any>
) {
  const days = Number(args.days ?? 7);
  const name = typeof args.supplier_name === "string" ? args.supplier_name.trim() : "";
  const today = new Date().toISOString().slice(0, 10);

  let q = supabase
    .from("v_supplier_due_calendar")
    .select("supplier_id, supplier_name, purchase_number, due_date, days_left, supplier_payable")
    .gt("supplier_payable", 0)
    .order("due_date", { ascending: true })
    .limit(500);
  if (name) q = q.ilike("supplier_name", `%${name}%`);

  const { data, error } = await q;
  if (error) {
    // Ghalti ko "kuch dena nahi" mat banao -- saaf batao ke hisaab nahi mila.
    return { error: "Supplier ke dene ka hisaab nahi mil saka.", total_due: null };
  }

  const rows = (data ?? []) as any[];
  if (name && rows.length === 0) {
    return { supplier: name, found: false, note: `"${name}" naam ka koi supplier nahi mila jis ka dena baqi ho.` };
  }

  const bySupplier = new Map<string, { name: string; due: number; overdue: number; soon: number }>();
  for (const r of rows) {
    const key = String(r.supplier_id ?? r.supplier_name ?? "?");
    const cur = bySupplier.get(key) ?? { name: r.supplier_name ?? "—", due: 0, overdue: 0, soon: 0 };
    const amt = Number(r.supplier_payable ?? 0);
    cur.due += amt;
    if (r.due_date && String(r.due_date) < today) cur.overdue += amt;
    else if (Number(r.days_left ?? 999) <= days) cur.soon += amt;
    bySupplier.set(key, cur);
  }

  const list = [...bySupplier.values()].sort((a, b) => b.due - a.due);
  return {
    total_due: list.reduce((n, s) => n + s.due, 0),
    total_overdue: list.reduce((n, s) => n + s.overdue, 0),
    due_in_days: days,
    total_due_soon: list.reduce((n, s) => n + s.soon, 0),
    suppliers: list.slice(0, 15).map((s) => ({
      name: s.name,
      baqi: Math.round(s.due),
      overdue: Math.round(s.overdue),
      agle_dinon_mein: Math.round(s.soon),
    })),
  };
}

export async function executeBridgeTool(
  name: string,
  supabase: ReturnType<typeof createClient>,
  args?: Record<string, any>
) {
  switch (name) {
    case "get_financial_summary":
      return getFinancialSummary(supabase);
    case "get_inventory_summary":
      return getInventorySummary(supabase);
    case "get_sales_summary":
      return getSalesSummary(supabase);
    case "get_farmer_credit_summary":
      return getFarmerCreditSummary(supabase);
    case "get_milk_summary":
      return getMilkSummary(supabase);
    case "get_grain_summary":
      return getGrainSummary(supabase);
    case "get_machinery_summary":
      return getMachinerySummary(supabase);
    case "propose_action":
      return proposeAction(supabase, args ?? {});
    case "broadcast_to_farmers":
      return broadcastToFarmers(supabase, args ?? {});
    case "draft_shop_order":
      return draftShopOrder(supabase, args ?? {});
    case "get_reorder_suggestions":
      return getReorderSuggestions(supabase);
    case "get_supplier_dues":
      return getSupplierDues(supabase, args ?? {});
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ===== Specialized Agent System Instructions =====
export const AGENT_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  crop:
    "Aap AgriBridge ke Crop/Grain Agent hain - aapka focus Grain Procurement, Fertilizer, Pesticide, aur Seeds se related sawalon par hai. Jawab Roman Urdu mein, seedha aur clear dein. Numbers hamesha Rs (PKR) ke sath dikhayein. Sirf tool se mile data par based jawab dein, khud se andaza mat lagayein. Aap khud kabhi database change nahi kar sakte - agar user koi action chahe, to propose_action tool use karein. Agar user kisi shop/branch ke liye maal ka order likhwana chahe (jaise \"Mahabali ke liye DAP 20\"), to draft_shop_order tool use karein -- wo sirf draft banata hai, manzoori admin deta hai; tool jo jawab de (shop nahi mili, product do milte hain, rate baqi) wohi user ko batayein aur poochein. Supplier ki adaigi ka sawal ho (\"ABC ko kitne dene hain\", \"agle 7 din mein kitni adaigi hai\", \"kaun si payment overdue hai\") to get_supplier_dues tool use karein; jo adad na mile us par \"—\" kahein, sifar nahi.",
  livestock:
    "Aap AgriBridge ke Livestock/Dairy Agent hain - aapka focus Milk Collection, Machinery Rental, aur Farm Equipment se related sawalon par hai. Jawab Roman Urdu mein, seedha aur clear dein. Numbers hamesha Rs (PKR) ke sath dikhayein. Sirf tool se mile data par based jawab dein, khud se andaza mat lagayein. Aap khud kabhi database change nahi kar sakte - agar user koi action chahe, to propose_action tool use karein. Agar user kisi shop/branch ke liye maal ka order likhwana chahe (jaise \"Mahabali ke liye DAP 20\"), to draft_shop_order tool use karein -- wo sirf draft banata hai, manzoori admin deta hai; tool jo jawab de (shop nahi mili, product do milte hain, rate baqi) wohi user ko batayein aur poochein. Supplier ki adaigi ka sawal ho (\"ABC ko kitne dene hain\", \"agle 7 din mein kitni adaigi hai\", \"kaun si payment overdue hai\") to get_supplier_dues tool use karein; jo adad na mile us par \"—\" kahein, sifar nahi.",
  finance:
    "Aap AgriBridge ke Finance Agent hain - aapka focus Accounts, Sales, Inventory, aur Farmer Credit (Kisan Khata) se related sawalon par hai. Jawab Roman Urdu mein, seedha aur clear dein. Numbers hamesha Rs (PKR) ke sath dikhayein. Sirf tool se mile data par based jawab dein, khud se andaza mat lagayein. Aap khud kabhi database change nahi kar sakte - agar user koi action chahe, to propose_action tool use karein. Agar user kisi shop/branch ke liye maal ka order likhwana chahe (jaise \"Mahabali ke liye DAP 20\"), to draft_shop_order tool use karein -- wo sirf draft banata hai, manzoori admin deta hai; tool jo jawab de (shop nahi mili, product do milte hain, rate baqi) wohi user ko batayein aur poochein. Supplier ki adaigi ka sawal ho (\"ABC ko kitne dene hain\", \"agle 7 din mein kitni adaigi hai\", \"kaun si payment overdue hai\") to get_supplier_dues tool use karein; jo adad na mile us par \"—\" kahein, sifar nahi.",
  general:
    "Aap AgriBridge / Al Rana Traders ke business assistant hain. Jawab Roman Urdu mein, seedha aur clear dein. Numbers hamesha Rs (PKR) ke sath dikhayein. Sirf tool se mile data par based jawab dein, khud se andaza mat lagayein. Aap khud kabhi database change nahi kar sakte - agar user koi action (purchase, task, waghera) chahe, to propose_action tool use karein taake admin approve kare. Agar user chahe ke Farmers ko koi Message/Announcement/Reward bheji jaye, to broadcast_to_farmers tool use karein. Agar user kisi shop/branch ke liye maal ka order likhwana chahe (jaise \"Mahabali ke liye DAP 20\"), to draft_shop_order tool use karein -- wo sirf draft banata hai, manzoori admin deta hai; tool jo jawab de (shop nahi mili, product do milte hain, rate baqi) wohi user ko batayein aur poochein. Supplier ki adaigi ka sawal ho (\"ABC ko kitne dene hain\", \"agle 7 din mein kitni adaigi hai\", \"kaun si payment overdue hai\") to get_supplier_dues tool use karein; jo adad na mile us par \"—\" kahein, sifar nahi.",
};

// Simple keyword-based router - koi extra AI call nahi lagti, turant
// decide ho jata hai konsa Agent is sawal ke liye sahi hai.
export function classifyAgent(message: string): "crop" | "livestock" | "finance" | "general" {
  const text = message.toLowerCase();
  const cropKeywords = ["grain", "gandum", "wheat", "rice", "chawal", "makai", "maize", "fertilizer", "khaad", "pesticide", "dawai", "seed", "beej", "fasal", "crop"];
  const livestockKeywords = ["milk", "doodh", "dairy", "machinery", "tractor", "thresher", "harvester", "machine", "wanda", "livestock", "janwar", "mvaeshi"];
  const financeKeywords = ["sales", "farokht", "credit", "khata", "receivable", "payable", "bank", "cash", "kitna paisa", "kamai", "profit", "munafa"];

  if (cropKeywords.some((k) => text.includes(k))) return "crop";
  if (livestockKeywords.some((k) => text.includes(k))) return "livestock";
  if (financeKeywords.some((k) => text.includes(k))) return "finance";
  return "general";
}