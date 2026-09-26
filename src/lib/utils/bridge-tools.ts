import { Type, type FunctionDeclaration } from "@google/genai";
import { aajKaKhana } from "@/lib/utils/format";
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
    // Malik (16 September): WhatsApp sirf OTP, Khata Recovery, aur
    // bill/statement ke liye -- ye AI se mansooba (ad-hoc) WhatsApp
    // bhi usi kharche mein shamil hota tha. AI ko sach batana zaroori
    // hai, warna wo "bhej diya" keh kar jhoot bolega.
    return {
      sent: false,
      message: "Ad-hoc WhatsApp message ab band hai (kharcha bachane ke liye) — sirf Announcement (in-app) bheji ja sakti hai.",
    };
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

// ===== Tool 12: Shop-specific stock analysis =====
// Ek shop ka: abhi kya hai, kya tez bika, kya mangwana hai (N din ke liye).
// Staff aur admin dono use kar sakte hain -- sirf apni shop ka data.
async function getShopStockAnalysis(
  supabase: ReturnType<typeof createClient>,
  args: { shop_name?: string; days?: number }
) {
  const shopName = (args.shop_name ?? "").trim();
  const days = Math.min(Math.max(Number(args.days ?? 15), 7), 90);

  if (!shopName) {
    return { error: "Shop ka naam chahiye (jaise 'Mahabali')." };
  }

  // Branch dhundho
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, is_main_branch")
    .eq("is_active", true)
    .ilike("name", `%${shopName}%`);
  const shops = (branches ?? []).filter((b) => !b.is_main_branch);
  if (shops.length === 0) {
    const { data: all } = await supabase
      .from("branches")
      .select("name")
      .eq("is_active", true)
      .eq("is_main_branch", false)
      .order("name")
      .limit(20);
    return {
      found: false,
      message: `"${shopName}" naam ki koi shop nahi mili.`,
      available_shops: (all ?? []).map((b) => b.name),
    };
  }
  if (shops.length > 1) {
    return {
      found: false,
      message: `"${shopName}" se kai shops milti hain -- kaun si?`,
      candidates: shops.map((b) => b.name),
    };
  }
  const shop = shops[0];

  // Is branch ki sales IDs (pichle N din)
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);

  const { data: salesRows } = await supabase
    .from("pos_sales")
    .select("id")
    .eq("branch_id", shop.id)
    .gte("created_at", periodStart.toISOString())
    .limit(2000);
  const saleIds = (salesRows ?? []).map((s) => s.id);

  // Sale items (agar koi sale thi)
  const byProduct = new Map<string, { qty: number; revenue: number }>();
  if (saleIds.length > 0) {
    const { data: items } = await supabase
      .from("pos_sale_items")
      .select("product_id, quantity, unit_price")
      .in("sale_id", saleIds)
      .limit(10000);
    (items ?? []).forEach((item: any) => {
      const cur = byProduct.get(item.product_id) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(item.quantity ?? 0);
      cur.revenue += Number(item.quantity ?? 0) * Number(item.unit_price ?? 0);
      byProduct.set(item.product_id, cur);
    });
  }

  // Products ki info (naam, pack_size, selling_price)
  const soldProductIds = [...byProduct.keys()];
  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size, selling_price, wholesale_price")
    .in("id", soldProductIds.length > 0 ? soldProductIds : ["__none__"])
    .eq("is_deleted", false);
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  // Inventory: pehle shop-specific (location_id), phir global fallback
  const { data: shopInv } = await supabase
    .from("inventory")
    .select("product_id, quantity_on_hand")
    .eq("location_id", shop.id);
  const useShopInv = (shopInv ?? []).length > 0;
  let invRows = shopInv ?? [];
  if (!useShopInv) {
    const { data: globalInv } = await supabase
      .from("inventory")
      .select("product_id, quantity_on_hand");
    invRows = globalInv ?? [];
  }
  const invMap = new Map<string, number>();
  invRows.forEach((r: any) => {
    invMap.set(r.product_id, (invMap.get(r.product_id) ?? 0) + Number(r.quantity_on_hand ?? 0));
  });

  // Analysis banayen
  type ProductRow = {
    product_id: string;
    product: string;
    sold: number;
    revenue: number;
    daily_rate: number;
    in_stock: number;
    days_left: number | null;
    reorder_qty: number;
    unit_price: number;
  };
  const analysis: ProductRow[] = [];

  byProduct.forEach((sales, productId) => {
    const prod = productMap.get(productId);
    if (!prod) return;
    const daily_rate = days > 0 ? sales.qty / days : 0;
    const in_stock = invMap.get(productId) ?? 0;
    const days_left = daily_rate > 0 ? Number((in_stock / daily_rate).toFixed(1)) : null;
    // Buffer: 7 din delivery + requested days ka stock
    const target = daily_rate * (days + 7);
    const reorder_qty = Math.max(0, Math.round(target - in_stock));
    const unit = Number(prod.wholesale_price ?? prod.selling_price ?? 0);
    analysis.push({
      product_id: productId,
      product: `${prod.name}${prod.pack_size ? ` (${prod.pack_size})` : ""}`,
      sold: Math.round(sales.qty),
      revenue: Math.round(sales.revenue),
      daily_rate: Number(daily_rate.toFixed(2)),
      in_stock: Math.round(in_stock),
      days_left,
      reorder_qty,
      unit_price: unit,
    });
  });

  // Tez bechne wale (top 8 by daily_rate)
  analysis.sort((a, b) => b.daily_rate - a.daily_rate);
  const fastMovers = analysis.slice(0, 8);

  // Slow movers (daily_rate < 0.3, bottom 5)
  const slowMovers = analysis.filter((a) => a.daily_rate < 0.3).slice(-5);

  // Reorder list (days_left <= days ya stock sifar)
  const reorderList = analysis
    .filter((a) => (a.days_left !== null && a.days_left < days) || (a.days_left === null && a.in_stock < 1))
    .sort((a, b) => (a.days_left ?? -1) - (b.days_left ?? -1));

  const totalRevenue = analysis.reduce((s, a) => s + a.revenue, 0);
  const totalOrderCost = reorderList.reduce((s, a) => s + a.reorder_qty * a.unit_price, 0);

  // Agar koi sale nahi
  if (analysis.length === 0) {
    return {
      found: true,
      shop: shop.name,
      period_days: days,
      message: `${shop.name} par pichle ${days} din mein koi POS sale nahi mili.`,
      total_revenue: 0,
      fast_movers: [],
      reorder_list: [],
      slow_movers: [],
      currency: "PKR",
    };
  }

  return {
    found: true,
    shop: shop.name,
    period_days: days,
    inventory_note: useShopInv ? "Shop ka alag inventory record mila" : "Global inventory (shop-specific nahi mila)",
    total_products_sold: analysis.length,
    total_revenue: totalRevenue,
    currency: "PKR",
    fast_movers: fastMovers.map((a) => ({
      product: a.product,
      sold_in_period: a.sold,
      revenue: a.revenue,
      daily_rate: a.daily_rate,
      in_stock: a.in_stock,
      days_left: a.days_left,
    })),
    reorder_list: reorderList.map((a) => ({
      product: a.product,
      in_stock: a.in_stock,
      days_left: a.days_left,
      suggested_order_qty: a.reorder_qty,
      unit_price: a.unit_price,
      estimated_cost: Math.round(a.reorder_qty * a.unit_price),
      urgency: (a.days_left !== null && a.days_left <= 3) || a.in_stock < 1 ? "URGENT" : a.days_left !== null && a.days_left <= 7 ? "jaldi" : "normal",
    })),
    slow_movers: slowMovers.map((a) => ({
      product: a.product,
      sold_in_period: a.sold,
      in_stock: a.in_stock,
      note: "Slow-moving — invest kam karein",
    })),
    order_summary: {
      total_items_to_order: reorderList.length,
      estimated_total_cost: Math.round(totalOrderCost),
      note: `${days} din ka stock + 7 din delivery buffer ke liye estimate`,
    },
  };
}

// ===== Tool 13: Complete Business Report =====
// Aaj / hafta / mahina — ek click par poori picture:
// total sales, category breakdown, top products, staff ranking, stock alerts.
async function getBusinessReport(
  supabase: ReturnType<typeof createClient>,
  args: { period?: string; days?: number }
) {
  // Period resolve karo
  let daysBack = 1;
  const p = (args.period ?? "").toLowerCase().trim();
  if (p === "aaj" || p === "today" || p === "1") daysBack = 1;
  else if (p === "hafta" || p === "week" || p === "7") daysBack = 7;
  else if (p === "mahina" || p === "month" || p === "30") daysBack = 30;
  else if (args.days) daysBack = Math.min(Math.max(Number(args.days), 1), 90);

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack);
  const startStr = start.toISOString();

  // Sales + branch + staff
  const { data: salesData } = await supabase
    .from("pos_sales")
    .select("id, total_amount, payment_mode, created_by, branches(name)")
    .gte("created_at", startStr)
    .limit(5000);

  let totalSales = 0;
  const byBranch = new Map<string, number>();
  const byPayment: Record<string, number> = { cash: 0, khata: 0, split: 0, bank: 0, kisan_card: 0 };
  const byStaffId = new Map<string, number>();

  (salesData ?? []).forEach((s: any) => {
    const amt = Number(s.total_amount ?? 0);
    totalSales += amt;
    const branch = Array.isArray(s.branches) ? s.branches[0] : s.branches;
    byBranch.set(branch?.name ?? "Unknown", (byBranch.get(branch?.name ?? "Unknown") ?? 0) + amt);
    if (byPayment[s.payment_mode] !== undefined) byPayment[s.payment_mode] += amt;
    if (s.created_by) byStaffId.set(s.created_by, (byStaffId.get(s.created_by) ?? 0) + amt);
  });

  // Staff names
  const staffIds = [...byStaffId.keys()];
  const staffNameMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", staffIds);
    (profiles ?? []).forEach((p: any) => staffNameMap.set(p.id, p.full_name ?? "—"));
  }
  const staffRanking = [...byStaffId.entries()]
    .map(([id, amt]) => ({ staff: staffNameMap.get(id) ?? "—", total: Math.round(amt) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Item-level data (products + category)
  const saleIds = (salesData ?? []).map((s: any) => s.id);
  const byProductId = new Map<string, { name: string; qty: number; revenue: number; category: string }>();
  const byCat = new Map<string, number>();

  if (saleIds.length > 0) {
    // Large sets mein 500 IDs tak limit (most common case thoda zyada)
    const batchIds = saleIds.slice(0, 800);
    const { data: items } = await supabase
      .from("pos_sale_items")
      .select("product_id, quantity, unit_price, products(name, pack_size, category)")
      .in("sale_id", batchIds)
      .limit(15000);

    (items ?? []).forEach((item: any) => {
      const prod = Array.isArray(item.products) ? item.products[0] : item.products;
      if (!prod) return;
      const qty = Number(item.quantity ?? 0);
      const rev = qty * Number(item.unit_price ?? 0);
      const cat = prod.category ?? "Other";
      const label = `${prod.name}${prod.pack_size ? ` (${prod.pack_size})` : ""}`;
      const cur = byProductId.get(item.product_id) ?? { name: label, qty: 0, revenue: 0, category: cat };
      cur.qty += qty;
      cur.revenue += rev;
      byProductId.set(item.product_id, cur);
      byCat.set(cat, (byCat.get(cat) ?? 0) + rev);
    });
  }

  const topProducts = [...byProductId.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((p) => ({ product: p.name, sold_qty: Math.round(p.qty), revenue: Math.round(p.revenue) }));

  const categoryBreakdown = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, rev]) => ({ category: cat, revenue: Math.round(rev) }));

  // Slow movers (revenue bottom 5 among products that sold something)
  const slowMovers = [...byProductId.values()]
    .filter((p) => p.revenue > 0)
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, 5)
    .map((p) => ({ product: p.name, sold_qty: Math.round(p.qty), revenue: Math.round(p.revenue) }));

  // Stock alerts (7 din se kam)
  const { data: reorderAlerts } = await supabase
    .from("v_reorder_suggestions")
    .select("name, on_hand, days_cover, urgency")
    .order("days_cover", { ascending: true, nullsFirst: true })
    .limit(10);
  const stockAlerts = (reorderAlerts ?? [])
    .filter((r: any) => r.days_cover == null || Number(r.days_cover) <= 10)
    .map((r: any) => ({
      product: r.name,
      days_left: r.days_cover == null ? null : Number(r.days_cover),
      urgency: r.urgency,
    }));

  // Bank balance
  const { data: bankAccounts } = await supabase
    .from("finance_accounts")
    .select("current_balance")
    .eq("is_active", true)
    .eq("account_type", "bank");
  const bankBalance = (bankAccounts ?? []).reduce((s, a) => s + Number(a.current_balance), 0);

  const periodLabel = daysBack === 1 ? "Aaj" : daysBack === 7 ? "Pichle 7 din" : `Pichle ${daysBack} din`;

  return {
    period: periodLabel,
    currency: "PKR",
    summary: {
      total_sales: Math.round(totalSales),
      transaction_count: (salesData ?? []).length,
      bank_balance: Math.round(bankBalance),
    },
    top_branch: [...byBranch.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({ branch: name, sales: Math.round(total) })),
    payment_mode_breakdown: byPayment,
    top_products: topProducts,
    slow_products: slowMovers,
    category_breakdown: categoryBreakdown,
    staff_ranking: staffRanking,
    stock_alerts: stockAlerts,
    stock_alert_count: stockAlerts.length,
  };
}

// ===== Tool 14: Staff Performance (kitne din mein kiski kitni sale) =====
async function getStaffPerformance(
  supabase: ReturnType<typeof createClient>,
  args: { days?: number }
) {
  const days = Math.min(Math.max(Number(args.days ?? 30), 1), 90);
  const start = new Date();
  start.setDate(start.getDate() - days);

  const { data: salesData } = await supabase
    .from("pos_sales")
    .select("total_amount, created_by, branches(name)")
    .gte("created_at", start.toISOString())
    .limit(10000);

  const byStaff = new Map<string, { total: number; count: number; branches: Set<string> }>();
  (salesData ?? []).forEach((s: any) => {
    if (!s.created_by) return;
    const cur = byStaff.get(s.created_by) ?? { total: 0, count: 0, branches: new Set() };
    cur.total += Number(s.total_amount ?? 0);
    cur.count += 1;
    const b = Array.isArray(s.branches) ? s.branches[0] : s.branches;
    if (b?.name) cur.branches.add(b.name);
    byStaff.set(s.created_by, cur);
  });

  const staffIds = [...byStaff.keys()];
  const nameMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", staffIds);
    (profiles ?? []).forEach((p: any) => nameMap.set(p.id, `${p.full_name ?? "—"} (${p.role})`));
  }

  const ranking = [...byStaff.entries()]
    .map(([id, d]) => ({
      staff: nameMap.get(id) ?? "—",
      total_sales: Math.round(d.total),
      transaction_count: d.count,
      avg_per_transaction: d.count > 0 ? Math.round(d.total / d.count) : 0,
      branches: [...d.branches].join(", "),
    }))
    .sort((a, b) => b.total_sales - a.total_sales);

  const totalAll = ranking.reduce((s, r) => s + r.total_sales, 0);
  return {
    period_days: days,
    currency: "PKR",
    total_sales_all_staff: totalAll,
    staff_count: ranking.length,
    ranking,
    top_performer: ranking[0] ?? null,
    note: `Sirf POS sales counted hain (${days} din)`,
  };
}

// ===== Tool 15: Buyer Recovery List (kaun kitna dena hai) =====
async function getBuyerRecovery(
  supabase: ReturnType<typeof createClient>,
  args: { buyer_name?: string }
) {
  const name = (args.buyer_name ?? "").trim();

  // Buyers table se outstanding balance
  let q = supabase
    .from("buyers")
    .select("id, name, phone, outstanding_balance, last_transaction_at")
    .gt("outstanding_balance", 0)
    .order("outstanding_balance", { ascending: false })
    .limit(30);
  if (name) q = q.ilike("name", `%${name}%`);

  const { data: buyerRows, error: buyerErr } = await q;

  // Fallback: branch_credit_balances view (agar buyers table structure alag ho)
  if (buyerErr || !buyerRows || buyerRows.length === 0) {
    const { data: bcRows } = await supabase
      .from("branch_credit_transactions")
      .select("customer_name, transaction_type, amount")
      .limit(5000);

    if (!bcRows || bcRows.length === 0) {
      return {
        found: false,
        note: "Buyer recovery data is waqt nahi mila (buyers table ya credit transactions). /admin/buyers safhe par dekhein.",
      };
    }

    const byCustomer = new Map<string, number>();
    (bcRows ?? []).forEach((t: any) => {
      const cust = t.customer_name ?? "—";
      const amt = Number(t.amount ?? 0);
      const cur = byCustomer.get(cust) ?? 0;
      if (t.transaction_type === "order_charge") byCustomer.set(cust, cur + amt);
      else if (t.transaction_type === "advance_payment") byCustomer.set(cust, cur - amt);
    });

    const withBalance = [...byCustomer.entries()]
      .filter(([, bal]) => bal > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([cust, bal]) => ({ buyer: cust, balance_due: Math.round(bal) }));

    return {
      currency: "PKR",
      total_outstanding: withBalance.reduce((s, r) => s + r.balance_due, 0),
      buyer_count: withBalance.length,
      recovery_list: withBalance,
      source: "branch_credit_transactions",
    };
  }

  const rows = (buyerRows ?? []).map((b: any) => ({
    buyer: b.name ?? "—",
    phone: b.phone ?? null,
    balance_due: Math.round(Number(b.outstanding_balance ?? 0)),
    last_transaction: b.last_transaction_at ? String(b.last_transaction_at).slice(0, 10) : null,
  }));

  return {
    currency: "PKR",
    total_outstanding: rows.reduce((s, r) => s + r.balance_due, 0),
    buyer_count: rows.length,
    recovery_list: rows,
    source: "buyers",
  };
}

// ===== Tool 16: Demand Forecast (kab kya khatam hoga, agle 7/15/30 din mein kya chahiye) =====
async function getDemandForecast(
  supabase: ReturnType<typeof createClient>,
  args: { days?: number; category?: string }
) {
  const days = Math.min(Math.max(Number(args.days ?? 15), 7), 60);
  const cat = (args.category ?? "").trim().toLowerCase();

  let q = supabase
    .from("v_reorder_suggestions")
    .select("name, pack_size, sold_30, on_hand, daily_rate, days_cover, suggested_qty, urgency, last_supplier_name, last_unit_cost")
    .order("days_cover", { ascending: true, nullsFirst: true })
    .limit(100);

  const { data, error } = await q;
  if (error) return { error: "Demand forecast nahi mila: " + error.message };

  let rows = (data ?? []) as any[];
  if (cat) rows = rows.filter((r) => (r.name ?? "").toLowerCase().includes(cat));

  // Forecast ke liye: target = daily_rate * (days + 7 buffer)
  const forecast = rows.map((r: any) => {
    const daily = Number(r.daily_rate ?? 0);
    const onHand = Number(r.on_hand ?? 0);
    const daysLeft = daily > 0 ? onHand / daily : null;
    const target = daily * (days + 7);
    const orderQty = Math.max(0, Math.round(target - onHand));
    const estimatedCost = r.last_unit_cost ? Math.round(orderQty * Number(r.last_unit_cost)) : null;
    return {
      product: `${r.name}${r.pack_size ? ` (${r.pack_size})` : ""}`,
      in_stock: Math.round(onHand),
      daily_rate: Number(daily.toFixed(2)),
      days_left: daysLeft == null ? null : Number(daysLeft.toFixed(1)),
      runs_out_in: daysLeft == null ? "hisaab nahi (bikri sifar)" : daysLeft <= 0 ? "KHATAM" : `${Math.round(daysLeft)} din`,
      order_for_next_N_days: orderQty,
      estimated_cost: estimatedCost,
      urgency: r.urgency ?? (daysLeft != null && daysLeft <= 3 ? "URGENT" : daysLeft != null && daysLeft <= 7 ? "jaldi" : "normal"),
      last_supplier: r.last_supplier_name ?? null,
    };
  });

  const urgent = forecast.filter((f) => f.urgency === "URGENT");
  const soon = forecast.filter((f) => f.urgency === "jaldi");
  const totalEstCost = forecast.reduce((s, f) => s + (f.estimated_cost ?? 0), 0);

  return {
    forecast_for_days: days,
    currency: "PKR",
    urgent_count: urgent.length,
    soon_count: soon.length,
    total_products: forecast.length,
    total_estimated_order_cost: totalEstCost > 0 ? Math.round(totalEstCost) : null,
    urgent_products: urgent,
    need_soon: soon,
    all_products: forecast,
    note: `Agle ${days} din ke liye + 7 din delivery buffer shamil hai`,
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
    name: "get_farmer_outstanding",
    description:
      "Ek farmer ka POORA baqaya deta hai -- machine, doodh, khad/input credit, aur POS chaaron jama kar ke (Khata Recovery dashboard jaisa). Jab user pooche 'falan farmer ka kitna baqaya hai', 'is kisan ka total kitna lena hai' -- sirf ek hissa (jaise sirf machine ya sirf khad) nahi, poora jama shuda adad. Alag alag tool (get_farmer_credit_summary, get_machinery_summary) khud jama kar ke total mat banayein -- wo sirf apna apna hissa dete hain, is se dobara-ginti ya adhoora adad ban sakta hai.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        farmer_name: {
          type: Type.STRING,
          description: "Farmer ka naam ya farmer code (jaise ka hissa bhi chalega).",
        },
      },
      required: ["farmer_name"],
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
  {
    name: "check_system_errors",
    description:
      "Malik (18 September): 'koi ghalti ho, kuch ho, mujhe pata chalna chahiye.' Poore system ki ghaltiyon ka ASAL khata (`/admin/errors` jo dikhata hai wahi) -- code, POS, inventory, purchase, machinery, finance, load-bill, kahin bhi. Jab user pooche 'koi masla/ghalti hui hai?', 'aaj system theek chal raha hai?', 'koi bug aaya?' -- ye tool use karein. Sirf abhi tak HAL NA hui (khuli) ghaltiyan wapas aati hain, purani hal-shuda nahi.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        severity: {
          type: Type.STRING,
          description: "'rukawat' (kaam ruk gaya), 'ghalti' (ghalat hua magar kaam chalta raha), ya 'khabar'. Khali chhoR dein to sab.",
        },
      },
    },
  },
  {
    name: "get_shop_stock_analysis",
    description:
      "Kisi ek shop/branch ka mukammal stock analysis: pichle N din mein kya bika (fast movers), kya slow hai, aur supplier ko order dene ke liye kya kya mangwana chahiye (har product ki tadad aur estimated cost ke sath). Jab user pooche 'Mahabali ka stock kya hai', 'is shop mein kya tez bika', 'is shop ke liye 15 din ka order kya banao', 'supplier ko kya order doon', 'kya mangwana hai', 'reorder list banao' -- ye tool use karein. `shop_name` zaroori hai; `days` default 15 hai.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        shop_name: {
          type: Type.STRING,
          description: "Shop/branch ka naam (jaise 'Mahabali', 'Main Branch'). Partial naam bhi chalega.",
        },
        days: {
          type: Type.NUMBER,
          description: "Kitne din ka analysis chahiye aur agle kitne din ke liye order banana hai (default 15, min 7, max 90).",
        },
      },
      required: ["shop_name"],
    },
  },
  {
    name: "get_business_report",
    description:
      "Poori business ki mukammal report: total sales, category-wise breakdown (fertilizer/pesticide/karyana), top-selling products, slow-moving products, branch comparison, staff ranking, payment mode, bank balance, aur stock alerts. Jab user pooche 'aaj ka business status batao', 'is hafte ki report do', 'is mahine ki performance kya rahi', 'sales summary batao', 'aaj ki sale kitni hai', 'top products kaun se hain', 'category-wise sale batao' -- ye tool use karein. period: 'aaj'/'today', 'hafta'/'week', 'mahina'/'month', ya custom 'days'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: "'aaj'/'today' (1 din), 'hafta'/'week' (7 din), 'mahina'/'month' (30 din). Default: aaj.",
        },
        days: {
          type: Type.NUMBER,
          description: "Custom din (1-90), agar period ki jagah specific number chahiye ho.",
        },
      },
    },
  },
  {
    name: "get_staff_performance",
    description:
      "Staff ki sale performance ranking: har staff member ne pichle N din mein kitni sale ki, kitne transactions, average per transaction, aur kaun top performer hai. Jab user pooche 'staff performance dikhao', 'kisne zyada sale ki', 'top seller kaun hai', 'staff ranking batao', 'Ali ne kitni sale ki' -- ye tool use karein.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days: {
          type: Type.NUMBER,
          description: "Kitne din ka performance chahiye (default 30, max 90).",
        },
      },
    },
  },
  {
    name: "get_buyer_recovery",
    description:
      "Buyers/customers ki recovery list: kaun kitna dena hai, kitna overdue hai, kiski payment baqi hai. Jab user pooche 'recovery list batao', 'kaunse customers ka pesa baqi hai', 'outstanding payment kaun se hain', 'kaun sa buyer pesa nahi de raha' -- ye tool use karein.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        buyer_name: {
          type: Type.STRING,
          description: "Ek specific buyer ka naam (partial bhi chalega). Khali chhoRein to sab buyers.",
        },
      },
    },
  },
  {
    name: "get_pending_approvals",
    description:
      "Bridge AI ke pending approval requests dikhata hai: jo orders ya actions AI ne draft kiye hain aur admin ki manzoori ka intezar kar rahe hain. Jab user pooche 'pending approvals kya hain', 'kaunse orders approve karne hain', 'AI ne kya banaya hai', 'action requests dikhao' -- ye tool use karein.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: "Sirf ek type ki approvals chahiye ho to (jaise 'order_draft', 'purchase_recommendation'). Khali chhoRein to sab.",
        },
      },
    },
  },
  {
    name: "get_demand_forecast",
    description:
      "Demand forecast: kaunsa product kab khatam hoga, agle N din mein kya kya mangwana chahiye, kaunse products urgent hain. Formula: roz ki bikri ke hisaab se. Jab user pooche 'agle 15 din mein kya khatam hoga', 'demand forecast karo', 'kaunse products urgent hain', 'pura reorder plan batao', 'kis cheez ka order doon' -- ye tool use karein. Category filter bhi de sakte hain (jaise 'fertilizer', 'pesticide').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days: {
          type: Type.NUMBER,
          description: "Agle kitne din ke liye forecast (default 15, max 60).",
        },
        category: {
          type: Type.STRING,
          description: "Sirf ek category ka forecast chahiye ho to (jaise 'fertilizer', 'pesticide', 'seed'). Khali chhoRein to sab.",
        },
      },
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
  const today = aajKaKhana();

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

/**
 * `/admin/errors` jo dikhata hai wahi -- `v_error_summary` (error_log ka
 * fingerprint se jama shuda view). Malik (18 September): "koi ghalti ho,
 * mujhe pata chalna chahiye" -- Abram ko wahi khata dete hain jo insaan
 * ko dikhta hai, koi alag/naya hisaab nahi banaya.
 */
async function checkSystemErrors(supabase: ReturnType<typeof createClient>, args: Record<string, any>) {
  const severity = typeof args.severity === "string" ? args.severity.trim() : "";

  let q = supabase
    .from("v_error_summary")
    .select("module, message, severity, kitni_dafa, aakhri_dafa, khuli")
    .gt("khuli", 0)
    .order("aakhri_dafa", { ascending: false })
    .limit(20);
  if (severity) q = q.eq("severity", severity);

  const { data, error } = await q;
  if (error) {
    return { error: "Ghaltiyon ka khata is waqt parha nahi ja saka.", checked: false };
  }

  const rows = (data ?? []) as any[];
  if (rows.length === 0) {
    return { koi_khuli_ghalti_nahi: true, note: "Abhi tak koi khuli (hal na hui) ghalti darj nahi -- ye khata /admin/errors se hai." };
  }

  return {
    khuli_ghaltiyon_ki_tadad: rows.length,
    ghaltiyan: rows.map((r) => ({
      module: r.module,
      paighaam: r.message,
      severity: r.severity,
      kitni_dafa: Number(r.kitni_dafa ?? 0),
      aakhri_dafa: r.aakhri_dafa,
    })),
  };
}

/**
 * Ek farmer ka POORA baqaya -- machine + doodh + khad/input + POS, ek
 * jagah se (`v_farmer_combined_balance`, migration 411). Ye AI ko wahi
 * ek jagah se hisaab lagane par majboor karta hai jo Khata Recovery
 * dashboard khud dikhata hai -- alag alag tool (get_farmer_credit_summary
 * sirf khad, get_machinery_summary sirf machine) jama kar ke khud se
 * "total" banana yahan jaan boojh kar mana hai, warna wahi ghalti dobara
 * ho sakti hai jo kabhi `harvest_area_acres` ke saath hui thi (adhoora
 * adad poora bata dena).
 */
async function getFarmerOutstanding(
  supabase: ReturnType<typeof createClient>,
  args: Record<string, any>
) {
  const name = typeof args.farmer_name === "string" ? args.farmer_name.trim() : "";
  if (!name) return { error: "Farmer ka naam chahiye.", found: false };

  const { data, error } = await supabase
    .from("v_farmer_combined_balance")
    .select("full_name, farmer_code, phone, machine_aur_gl_baqi, doodh_baqi, khad_baqi, pos_baqi, total_baqi, last_activity")
    .or(`full_name.ilike.%${name}%,farmer_code.ilike.%${name}%`)
    .order("total_baqi", { ascending: false })
    .limit(5);

  if (error) return { error: "Farmer ka baqaya nikalte waqt masla hua.", found: false };
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return { farmer_name: name, found: false, note: `"${name}" naam ka koi farmer nahi mila.` };

  return {
    found: true,
    matches: rows.map((r) => ({
      farmer_name: r.full_name,
      farmer_code: r.farmer_code,
      phone: r.phone,
      machine_aur_ledger_baqi: Number(r.machine_aur_gl_baqi ?? 0),
      doodh_baqi: Number(r.doodh_baqi ?? 0),
      khad_baqi: Number(r.khad_baqi ?? 0),
      pos_baqi: Number(r.pos_baqi ?? 0),
      total_baqi: Number(r.total_baqi ?? 0),
      last_activity: r.last_activity,
    })),
    currency: "PKR",
  };
}

// ===== Tool 17: Pending Approvals (AI action requests jo admin ki approval ka intezar kar rahi hain) =====
async function getPendingApprovals(
  supabase: ReturnType<typeof createClient>,
  args: { type?: string }
) {
  let q = supabase
    .from("bridge_ai_action_requests")
    .select("id, action_type, description, details, status, created_at, created_order_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);
  if (args.type) q = q.eq("action_type", args.type);
  const { data, error } = await q;
  if (error) return { error: "Pending approvals nahi mil sakein: " + error.message };
  const rows = (data ?? []) as any[];
  if (rows.length === 0) {
    return { pending_count: 0, note: "Abhi koi bhi approval pending nahi.", link: "/admin/bridge-ai/action-requests" };
  }
  return {
    pending_count: rows.length,
    approvals: rows.map((r) => ({
      id: String(r.id).slice(0, 8),
      type: r.action_type,
      description: r.description,
      details: r.details ?? null,
      submitted_at: r.created_at ? String(r.created_at).slice(0, 10) : null,
      has_draft_order: !!r.created_order_id,
    })),
    action: "Approve/reject karne ke liye /admin/bridge-ai/action-requests par jayein.",
  };
}

// ===== Role-based gating =====
// Company-wide financial aur operational data sirf broad roles ko —
// sales/shop staff sirf apna kaam dekh sakta hai, business ka poora
// khata unhe nahi dikhna chahiye.
const BROAD_ROLES = new Set(["owner", "super_admin", "admin", "finance", "manager"]);

const STAFF_ALLOWED_TOOLS = new Set([
  "propose_action",
  "draft_shop_order",
  "get_reorder_suggestions",
  "check_system_errors",
  "get_farmer_outstanding",
  "get_shop_stock_analysis",
]);

/** Staff ke liye sirf allowed tools ki declarations bhejta hai Gemini ko. */
export function bridgeToolsForRole(role: string): FunctionDeclaration[] {
  if (BROAD_ROLES.has(role)) return bridgeToolDeclarations;
  return bridgeToolDeclarations.filter((t) => STAFF_ALLOWED_TOOLS.has(t.name!));
}

export async function executeBridgeTool(
  name: string,
  supabase: ReturnType<typeof createClient>,
  args?: Record<string, any>,
  userRole?: string
) {
  if (userRole && !BROAD_ROLES.has(userRole) && !STAFF_ALLOWED_TOOLS.has(name)) {
    return { error: "Aap ke role ke liye ye maloomat nahi hai. Apne manager se poochein.", access_denied: true };
  }
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
    case "get_farmer_outstanding":
      return getFarmerOutstanding(supabase, args ?? {});
    case "check_system_errors":
      return checkSystemErrors(supabase, args ?? {});
    case "get_shop_stock_analysis":
      return getShopStockAnalysis(supabase, args ?? {});
    case "get_business_report":
      return getBusinessReport(supabase, args ?? {});
    case "get_staff_performance":
      return getStaffPerformance(supabase, args ?? {});
    case "get_buyer_recovery":
      return getBuyerRecovery(supabase, args ?? {});
    case "get_demand_forecast":
      return getDemandForecast(supabase, args ?? {});
    case "get_pending_approvals":
      return getPendingApprovals(supabase, args ?? {});
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ===== Specialized Agent System Instructions =====
export const AGENT_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  crop:
    "Aap ka naam Abram hai. Aap AgriBridge ke Crop/Grain Agent hain - aapka focus Grain Procurement, Fertilizer, Pesticide, aur Seeds se related sawalon par hai. Jawab Roman Urdu mein, seedha aur clear dein. Numbers hamesha Rs (PKR) ke sath dikhayein. Sirf tool se mile data par based jawab dein, khud se andaza mat lagayein. Aap khud kabhi database change nahi kar sakte - agar user koi action chahe, to propose_action tool use karein. Agar user kisi shop ka stock, fast movers, slow movers, ya supplier ko order dene ke liye list pooche (jaise 'Mahabali ka stock kya hai', '15 din ka order kya hoga', 'supplier ko kya order doon', 'kya mangwana hai') to get_shop_stock_analysis tool use karein -- ye khud DB se data lekar complete reorder list banata hai. Agar user kisi shop/branch ke liye maal ka order likhwana chahe (jaise \"Mahabali ke liye DAP 20\"), to draft_shop_order tool use karein -- wo sirf draft banata hai, manzoori admin deta hai; tool jo jawab de (shop nahi mili, product do milte hain, rate baqi) wohi user ko batayein aur poochein. Supplier ki adaigi ka sawal ho (\"ABC ko kitne dene hain\", \"agle 7 din mein kitni adaigi hai\", \"kaun si payment overdue hai\") to get_supplier_dues tool use karein; jo adad na mile us par \"—\" kahein, sifar nahi. Kisi farmer ka POORA baqaya poocha jaye (\"falan kisan ka kitna baqaya hai\", \"is farmer ka total lena kitna hai\") to get_farmer_outstanding tool use karein -- ye machine+doodh+khad+POS chaaron jama deta hai. Alag alag tool (get_farmer_credit_summary sirf khad, get_machinery_summary sirf machine) khud jama kar ke total mat banayein. Koi ghalti/masla/bug poochein (\"koi ghalti hui hai\", \"system theek chal raha hai?\", \"koi masla to nahi\") to check_system_errors tool use karein -- ye asal /admin/errors ka khata hai, khud se \"sab theek hai\" mat kahein.",
  livestock:
    "Aap ka naam Abram hai. Aap AgriBridge ke Livestock/Dairy Agent hain - aapka focus Milk Collection, Machinery Rental, aur Farm Equipment se related sawalon par hai. Jawab Roman Urdu mein, seedha aur clear dein. Numbers hamesha Rs (PKR) ke sath dikhayein. Sirf tool se mile data par based jawab dein, khud se andaza mat lagayein. Aap khud kabhi database change nahi kar sakte - agar user koi action chahe, to propose_action tool use karein. Agar user kisi shop ka stock, fast movers, slow movers, ya supplier ko order dene ke liye list pooche (jaise 'Mahabali ka stock kya hai', '15 din ka order kya hoga', 'supplier ko kya order doon', 'kya mangwana hai') to get_shop_stock_analysis tool use karein -- ye khud DB se data lekar complete reorder list banata hai. Agar user kisi shop/branch ke liye maal ka order likhwana chahe (jaise \"Mahabali ke liye DAP 20\"), to draft_shop_order tool use karein -- wo sirf draft banata hai, manzoori admin deta hai; tool jo jawab de (shop nahi mili, product do milte hain, rate baqi) wohi user ko batayein aur poochein. Supplier ki adaigi ka sawal ho (\"ABC ko kitne dene hain\", \"agle 7 din mein kitni adaigi hai\", \"kaun si payment overdue hai\") to get_supplier_dues tool use karein; jo adad na mile us par \"—\" kahein, sifar nahi. Kisi farmer ka POORA baqaya poocha jaye (\"falan kisan ka kitna baqaya hai\", \"is farmer ka total lena kitna hai\") to get_farmer_outstanding tool use karein -- ye machine+doodh+khad+POS chaaron jama deta hai. Alag alag tool (get_farmer_credit_summary sirf khad, get_machinery_summary sirf machine) khud jama kar ke total mat banayein. Koi ghalti/masla/bug poochein (\"koi ghalti hui hai\", \"system theek chal raha hai?\", \"koi masla to nahi\") to check_system_errors tool use karein -- ye asal /admin/errors ka khata hai, khud se \"sab theek hai\" mat kahein.",
  finance:
    "Aap ka naam Abram hai. Aap AgriBridge ke Finance Agent hain - aapka focus Accounts, Sales, Inventory, aur Farmer Credit (Kisan Khata) se related sawalon par hai. Jawab Roman Urdu mein, seedha aur clear dein. Numbers hamesha Rs (PKR) ke sath dikhayein. Sirf tool se mile data par based jawab dein, khud se andaza mat lagayein. Aap khud kabhi database change nahi kar sakte - agar user koi action chahe, to propose_action tool use karein. Agar user kisi shop ka stock, fast movers, slow movers, ya supplier ko order dene ke liye list pooche (jaise 'Mahabali ka stock kya hai', '15 din ka order kya hoga', 'supplier ko kya order doon', 'kya mangwana hai') to get_shop_stock_analysis tool use karein -- ye khud DB se data lekar complete reorder list banata hai. Agar user kisi shop/branch ke liye maal ka order likhwana chahe (jaise \"Mahabali ke liye DAP 20\"), to draft_shop_order tool use karein -- wo sirf draft banata hai, manzoori admin deta hai; tool jo jawab de (shop nahi mili, product do milte hain, rate baqi) wohi user ko batayein aur poochein. Supplier ki adaigi ka sawal ho (\"ABC ko kitne dene hain\", \"agle 7 din mein kitni adaigi hai\", \"kaun si payment overdue hai\") to get_supplier_dues tool use karein; jo adad na mile us par \"—\" kahein, sifar nahi. Kisi farmer ka POORA baqaya poocha jaye (\"falan kisan ka kitna baqaya hai\", \"is farmer ka total lena kitna hai\") to get_farmer_outstanding tool use karein -- ye machine+doodh+khad+POS chaaron jama deta hai. Alag alag tool (get_farmer_credit_summary sirf khad, get_machinery_summary sirf machine) khud jama kar ke total mat banayein. Koi ghalti/masla/bug poochein (\"koi ghalti hui hai\", \"system theek chal raha hai?\", \"koi masla to nahi\") to check_system_errors tool use karein -- ye asal /admin/errors ka khata hai, khud se \"sab theek hai\" mat kahein.",
  general:
    "Aap ka naam Abram hai. Aap AgriBridge / Al Rana Traders ke AI Business Command Center hain. Jawab Roman Urdu mein, seedha aur clear dein. Numbers hamesha Rs (PKR) ke sath dikhayein. Sirf tool se mile data par based jawab dein, khud se andaza mat lagayein. Aap khud kabhi database change nahi kar sakte - agar user koi action (purchase, task, waghera) chahe, to propose_action tool use karein taake admin approve kare. TOOL SELECTION GUIDE: (1) 'Aaj/hafte/mahine ka business status/report/summary' → get_business_report. (2) 'Staff performance/ranking/kisne zyada sale ki' → get_staff_performance. (3) 'Recovery list/buyer payment baqi/customer outstanding' → get_buyer_recovery. (4) 'Demand forecast/kya khatam hoga/agle N din mein kya chahiye/pura reorder plan' → get_demand_forecast. (5) 'Ek shop ka stock/Mahabali ka stock/supplier order list' → get_shop_stock_analysis. (6) 'Kya mangwana hai (overall)' → get_reorder_suggestions ya get_demand_forecast. (7) Shop order likhwana (draft banana) → draft_shop_order. (8) Agar user chahe ke Farmers ko koi Message bheji jaye → broadcast_to_farmers. (9) Supplier ki adaigi ('ABC ko kitne dene hain', 'overdue payment') → get_supplier_dues. (10) Ek farmer ka POORA baqaya → get_farmer_outstanding (machine+doodh+khad+POS). (11) System ghalti/masla → check_system_errors. Kisi bhi sawal mein pehle tool call karo, phir jawab do -- khud se koi andaza mat lagao.",
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