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

export async function loadNeedsAttention(): Promise<AttentionItem[]> {
  const today = new Date().toISOString().slice(0, 10);
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
    { key: "stock_count_open", label: "na_stock_count_open", count: stockCountOpen, href: "/admin/stock-count", tone: "blue", area: "inventory" },
  ];
  return items;
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
