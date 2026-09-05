import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * "Needs Attention" (Guided ERP, qadam B).
 *
 * Har role ke liye ek fehrist: kya baqi hai, kitna, aur kahan jaana hai.
 * Ginti asal tables se, service client se -- RLS wali rok ke peeche
 * sifar ko asal adad samajhna is project mein teen dafa ghalat adad de
 * chuka hai. Jo ginti kisi wajah se na mile wo NULL rehti hai aur safhe
 * par "—" dikhti hai, 0 nahi.
 *
 * Banday ko sirf wo qatarein dikhti hain jin ka safha us par khulta
 * hai -- band darwaze par ginti dikhana waqt bhi zaya karta hai aur
 * bharosa bhi.
 */
export interface AttentionItem {
  key: string;
  label: TranslationKey;
  count: number | null;
  href: string;
  tone: "red" | "amber" | "blue" | "gray";
  /** Kis dashboard ka kaam hai -- department ke safhe par chhantne ke liye. */
  area: "purchase" | "inventory" | "products" | "sales" | "finance" | "ai" | "admin";
}

type Q = (q: any) => any;

async function count(table: string, apply: Q): Promise<number | null> {
  try {
    const service = createServiceClient();
    const q = apply(service.from(table as never).select("id", { count: "exact", head: true }));
    const { count: n, error } = await q;
    if (error) return null;
    return n ?? 0;
  } catch {
    return null;
  }
}

async function countView(view: string, column: string, apply: Q): Promise<number | null> {
  try {
    const service = createServiceClient();
    const q = apply(service.from(view as never).select(column, { count: "exact", head: true }));
    const { count: n, error } = await q;
    if (error) return null;
    return n ?? 0;
  } catch {
    return null;
  }
}

/**
 * Jo kaam KHAAS is bande ke zimme aaya.
 *
 * Baqi saari qatarein poore idare ki hain -- "das purchase manzoori ke
 * muntazir hain" har us bande ko dikhta hai jis ke paas wo safha hai.
 * Handoff us se alag cheez hai: wo kisi ne aap ke haath mein diya hai.
 * Is liye ye alag se jama hoti hai, aur usi bande ke apne RLS se --
 * service client se laane par har banda har kisi ka kaam dekh leta
 * (279 ka sabaq).
 */
async function handoffItems(): Promise<AttentionItem[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("v_my_handoffs").select("to_route, to_feature");
    if (error || !data || data.length === 0) return [];

    // Ek safhe par kai kaam ho sakte hain -- sidebar par ek hi adad
    // chahiye, har kaam ki apni qatar nahi.
    const byRoute = new Map<string, number>();
    for (const r of data) {
      const route = String(r.to_route ?? "");
      if (!route) continue;
      byRoute.set(route, (byRoute.get(route) ?? 0) + 1);
    }

    return Array.from(byRoute.entries()).map(([route, n]) => ({
      key: `handoff:${route}`,
      label: "wd_my_work" as TranslationKey,
      count: n,
      href: route,
      // Ye laal nahi -- ye ghalti nahi, kaam hai. Har cheez laal karne
      // se laal ka matlab khatam ho jata hai.
      tone: "blue" as const,
      area: "admin" as const,
    }));
  } catch {
    return [];
  }
}

export async function loadNeedsAttention(): Promise<AttentionItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  // Pichhla mahina -- ghisai hamesha guzre hue mahine ki chalti hai.
  const ab = new Date();
  const pichhlaMahinaShuru = new Date(Date.UTC(ab.getUTCFullYear(), ab.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const pichhlaMahinaAakhir = new Date(Date.UTC(ab.getUTCFullYear(), ab.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const [
    purchaseApproval,
    purchaseSentBack,
    purchaseReceive,
    billDrafts,
    shopOrdersApproval,
    shopOrdersGrn,
    productsRate,
    productsSetup,
    productsExpiry,
    productsApproval,
    productEdits,
    intakeOpen,
    dueOverdue,
    dueSoon,
    reorderUrgent,
    aiRequests,
    accessPending,
    accessConflicts,
    cashCloseMissing,
    stockCountOpen,
    depreciationDue,
  ] = await Promise.all([
    count("purchases", (q) => q.eq("status", "pending").eq("review_status", "submitted")),
    count("purchases", (q) => q.eq("status", "pending").eq("review_status", "sent_back")),
    count("purchases", (q) => q.eq("status", "pending").eq("review_status", "approved")),
    count("supplier_bill_reads", (q) => q.eq("status", "draft")),
    count("agri_orders", (q) => q.in("status", ["submitted", "sales_verified", "finance_verified"])),
    count("agri_orders", (q) => q.in("status", ["dispatched", "in_transit"])),
    count("products", (q) => q.eq("is_deleted", false).eq("sale_rate_pending", true)),
    countView("v_product_setup_queue", "id", (q) => q),
    countView("v_product_setup_queue", "id", (q) => q.or("expired.eq.true,expiry_soon.eq.true")),
    count("products", (q) => q.eq("is_deleted", false).eq("is_verified", false)),
    count("product_edit_requests", (q) => q.eq("status", "pending")),
    count("product_intake_batches", (q) => q.eq("status", "draft")),
    countView("v_supplier_due_calendar", "purchase_id", (q) => q.lt("due_date", today).gt("supplier_payable", 0)),
    countView("v_supplier_due_calendar", "purchase_id", (q) => q.gte("due_date", today).lte("days_left", 7).gt("supplier_payable", 0)),
    countView("v_reorder_suggestions", "product_id", (q) => q.in("urgency", ["out", "critical"])),
    count("bridge_ai_action_requests", (q) => q.eq("status", "pending")),
    count("access_requests", (q) => q.eq("status", "pending")),
    count("access_conflict_findings", (q) => q.eq("status", "open").in("severity", ["high", "critical"])),
    // Raat ki ginti jin shakhon ki abhi baqi hai. Ye "kaam baqi hai" ki
    // sab se rozana misal hai, aur pehle sirf department ke adad mein
    // gini jati thi -- banday ki apni fehrist mein nahi aati thi.
    countView("v_cash_close_missing", "branch_id", (q) => q),
    count("stock_counts", (q) => q.eq("status", "counting")),
    // Pichhle mahine ki ghisai jin asaason par abhi charhni baqi hai.
    // Ye kaam mahine mein ek dafa hota hai, aur bhoolne par sab se der
    // se pakRa jata hai: kharcha kam, nafa zyada -- aur dono theek
    // lagte hain jab tak koi asaason ki fehrist na khole.
    count("fixed_assets", (q) =>
      q
        .eq("status", "active")
        .lte("in_service_on", pichhlaMahinaAakhir)
        .or(`depreciated_upto.is.null,depreciated_upto.lt.${pichhlaMahinaShuru}`)
    ),
  ]);

  const items: AttentionItem[] = [
    { key: "purchase_approval", label: "na_purchase_approval", count: purchaseApproval, href: "/admin/purchases", tone: "amber", area: "purchase" },
    { key: "purchase_sent_back", label: "na_purchase_sent_back", count: purchaseSentBack, href: "/admin/purchases", tone: "red", area: "purchase" },
    { key: "purchase_receive", label: "na_purchase_receive", count: purchaseReceive, href: "/admin/inventory/receiving", tone: "blue", area: "inventory" },
    { key: "bill_drafts", label: "na_bill_drafts", count: billDrafts, href: "/admin/products/bill-rates", tone: "amber", area: "purchase" },
    { key: "shop_orders_approval", label: "na_shop_orders_approval", count: shopOrdersApproval, href: "/admin/agri-orders", tone: "amber", area: "sales" },
    { key: "shop_orders_grn", label: "na_shop_orders_grn", count: shopOrdersGrn, href: "/admin/purchases/grn", tone: "blue", area: "inventory" },
    { key: "products_rate", label: "na_products_rate", count: productsRate, href: "/admin/products/setup?f=rate", tone: "red", area: "products" },
    { key: "products_setup", label: "na_products_setup", count: productsSetup, href: "/admin/products/setup", tone: "amber", area: "products" },
    { key: "products_expiry", label: "na_products_expiry", count: productsExpiry, href: "/admin/products/setup?f=expiry", tone: "amber", area: "products" },
    { key: "products_approval", label: "na_products_approval", count: productsApproval, href: "/admin/products/pending", tone: "amber", area: "products" },
    { key: "product_edits", label: "na_product_edits", count: productEdits, href: "/admin/products/pending-edits", tone: "gray", area: "products" },
    { key: "intake_open", label: "na_intake_open", count: intakeOpen, href: "/admin/products/intake", tone: "gray", area: "products" },
    { key: "due_overdue", label: "na_due_overdue", count: dueOverdue, href: "/admin/purchases/bills", tone: "red", area: "finance" },
    { key: "due_soon", label: "na_due_soon", count: dueSoon, href: "/admin/purchases/bills", tone: "amber", area: "finance" },
    { key: "reorder_urgent", label: "na_reorder_urgent", count: reorderUrgent, href: "/admin/products/reorder", tone: "red", area: "purchase" },
    { key: "ai_requests", label: "na_ai_requests", count: aiRequests, href: "/admin/bridge-ai/action-requests", tone: "blue", area: "ai" },
    { key: "access_pending", label: "na_access_pending", count: accessPending, href: "/admin/access-requests", tone: "amber", area: "admin" },
    { key: "access_conflicts", label: "na_access_conflicts", count: accessConflicts, href: "/admin/access-requests?tab=conflicts", tone: "red", area: "admin" },
    { key: "cash_close_missing", label: "na_cash_close_missing", count: cashCloseMissing, href: "/admin/cash-close", tone: "amber", area: "finance" },
    { key: "depreciation_due", label: "na_depreciation_due", count: depreciationDue, href: "/admin/finance/assets/depreciation", tone: "amber", area: "finance" },
    { key: "stock_count_open", label: "na_stock_count_open", count: stockCountOpen, href: "/admin/stock-count", tone: "blue", area: "inventory" },
  ];

  // Jo kaam kisi ne KHAAS is bande ke haath mein diya, wo sab se upar.
  // Idare ki aam qatar aur "aap ke zimme" ek jaisi cheezein nahi.
  //
  // Yahan koi user id nahi bheji jati: v_my_handoffs khud us bande tak
  // mehdood hai jo poochh raha hai (security_invoker). Id haath se
  // bhejna wo raasta banata hai jahan koi jagah usay bhejna bhool jaye
  // aur wahan har kisi ka kaam nazar aane lage.
  return [...(await handoffItems()), ...items];
}

/** Sirf wo qatarein jo is banday ke raaston par khulti hain, aur jin mein kuch hai (ya ginti hi nahi mil saki). */
export function filterAttention(items: AttentionItem[], allowedRoutes: string[] | null): AttentionItem[] {
  return items.filter((it) => {
    if (it.count === 0) return false;
    if (!allowedRoutes) return true;
    const path = it.href.split("?")[0];
    return allowedRoutes.some((r) => path === r || path.startsWith(r + "/"));
  });
}
