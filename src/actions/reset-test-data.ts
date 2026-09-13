"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
  /** Kya kya mita -- ginti ke sath, taake bharosa ho ke waqai gaya. */
  notice?: string;
}

/**
 * Jo cheezen is fehrist mein JAAN BOOJH KAR nahi hain:
 *
 *   audit_logs -- is par mitane ki rok lagi hui hai, aur wo rok theek
 *     hai. Audit ka poora maqsad yehi hai ke jo hua us ka nishan rahe.
 *     Reset us ka data nahi, sirf kaam ka data mitata hai.
 *
 *   finance_accounts -- ye setup hain (cash box, bank ka khata), test
 *     data nahi. In par payment_method_account_map khara hai. Aur in ka
 *     balance khud theek ho jata hai: finance_transactions ki har qatar
 *     mitte waqt trigger balance ulta kar deta hai, is liye sab khate
 *     apne opening_balance par wapas chale jate hain -- haath se likhne
 *     ki zaroorat hi nahi (aur us par apni rok bhi lagi hui hai).
 *
 *   farmer_credit_balances, milk_farmer_balances, grain_farmer_balances
 *     -- ye TABLE hain hi nahi, VIEW hain. In ki apni koi qatar nahi
 *     hoti; jab in ki bunyaad wali tables saaf ho jati hain to ye khud
 *     khali ho jate hain.
 *
 * Every table that gets wiped by "Reset Test Data". Products, Categories,
 * Brands, Companies, Staff (profiles), Organizations, Branches, Shops,
 * Warehouses, Website CMS, and Settings/Config tables are intentionally
 * NOT in this list — they survive every reset.
 */
const TABLES_TO_CLEAR = [
  // AgriBridge Ordering
  "agri_complaints", "agri_deliveries",
  "agri_dispatch_items", "agri_dispatches", "agri_feedback", "agri_grn_items",
  "agri_grns", "agri_order_items", "agri_order_payments", "agri_order_timeline",
  "agri_orders", "bridge_order_items", "bridge_orders",
  // AI
  "ai_crop_reports", "ai_purchase_suggestions", "bridge_ai_action_requests", "bridge_ai_activity_log",
  // Logs
  "activity_logs", "application_activity_log", "notifications",
  // HR
  "attendance_records", "interview_scores", "job_applications", "job_offers", "job_vacancies",
  "salary_payments", "staff_credit_ledger", "staff_details", "staff_messages", "staff_product_permissions",
  // Finance
  "branch_credit_accounts", "branch_credit_transactions", "capital_injections",
  "company_expense_requests", "credit_requests", "finance_transactions",
  "khata_accounts", "khata_transactions", "payments", "wallet_transactions", "wallets",
  "escrow_transactions", "replacement_fund_withdrawals",
  // CRM
  "buyers", "buyer_payments", "customers", "customer_ledger", "dealers", "dealer_customers",
  "dealer_inventory", "dealer_payments", "dealer_payouts", "dealer_service_areas", "dealer_users",
  "investors", "investor_inquiries", "investor_investments", "investor_returns", "investment_deals",
  "investment_ledger", "suppliers", "supplier_payments", "supplier_payment_requests",
  "company_reps",
  // Farmers/Farm
  "farmers", "farms", "farm_visits", "farmer_credit_ledger",
  "farmer_produce_payouts", "crop_diagnoses", "crop_expenses", "crop_history",
  "crop_product_recommendations", "harvest_records", "soil_test_records", "water_test_records",
  "produce_listings", "produce_orders",
  // Agri Inputs
  "fertilizer_items", "fertilizer_requests", "livestock_loans", "machinery_requests",
  // Dairy
  "milk_entries", "milk_payments", "milk_route_collections",
  "milk_type_migrations", "generator_logs", "fuel_logs", "maintenance_logs", "monthly_expenses",
  // Grain
  "grain_procurement_entries", "grain_procurement_payments",
  // Fleet
  "dispatch_vehicles", "driver_payments", "drivers", "vehicle_maintenance_records", "vehicles",
  // Inventory/Stock
  "inventory", "stock_batches", "stock_movements", "stock_transfers", "warehouse_bins",
  // Sales/Purchases
  "sales", "sale_items", "purchases", "purchase_items", "purchase_returns", "pos_sales",
  "pos_sale_items", "pos_sale_payment_details", "product_edit_requests",
  // Shop Rent
  "shop_bills", "shop_rent_agreements", "shop_rent_payments",
  // Misc
  "password_reset_tokens",
];

/**
 * Ginti ke khane -- in mein `id` ka khana hai hi nahi.
 *
 * Ye tables `year` par khare hain. Neeche wala delete `id` par chalta
 * hai, is liye ye har dafa nakaam hoti thin aur screen par
 * "column ... .id does not exist" likha aata tha. Nateeja: data mit
 * jata magar agli booking phir bhi purani ginti se aage barhti --
 * MB-2026-00003, jabke koi booking maujood hi nahi.
 */
const COUNTER_TABLES = [
  "agri_complaint_counters", "agri_dispatch_counters", "agri_grn_counters", "agri_order_counters",
  "agri_payment_counters", "agri_return_counters", "company_expense_counters", "grain_sale_counters",
  "milk_collection_counters", "stock_loss_counters", "supplier_payment_request_counters",
  "vehicle_log_counters", "whatsapp_submission_counters",
];

async function isLive(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "is_live").maybeSingle();
  return data?.value === true || data?.value === "true";
}

export async function resetTestData(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const confirmText = String(formData.get("confirm_text") ?? "");
  if (confirmText !== "DELETE TEST DATA") {
    return { error: "Confirmation text sahi nahi hai. Bilkul 'DELETE TEST DATA' likhein." };
  }

  if (await isLive()) {
    return { error: "System 'LIVE' lock ho chuka hai — Reset Test Data ab hamesha ke liye band hai. Real data ko koi khatra nahi." };
  }

  const serviceClient = createServiceClient();
  const errors: string[] = [];

  // Table ka naam chalte waqt tay hota hai, is liye types yahan mel
  // nahi kha sakteen -- fehrist ek hi jagah likhi hui hai aur wohi
  // sach hai.
  const clear = async (table: string, keyColumn: "id" | "year") => {
    const { error } = await (serviceClient.from(table as never) as never as {
      delete: () => { not: (c: string, o: string, v: null) => Promise<{ error: { message: string } | null }> };
    })
      .delete()
      .not(keyColumn, "is", null);
    if (error) errors.push(`${table}: ${error.message}`);
  };

  // MACHINERY AUR LEDGER -- ye yahan se nahi mit sakte.
  //
  // In par mitane ki rok lagi hui hai (journal_entries, machinery_bills,
  // machinery_payments, booking ki timeline, cash closing). Rok theek
  // hai: kitabein badalne ke liye reversal hoti hai, delete nahi.
  //
  // Magar "live hone se pehle test ka data mitana" us rok ka jaiz
  // istisna hai -- aur rok sirf ek transaction ke andar khulti hai.
  // Har delete yahan se alag request hoti hai, yani alag transaction,
  // is liye ye kaam database ke andar ek hi function mein hota hai.
  //
  // Pehle ye tables fehrist mein thin hi nahi. Nateeja us se bhi bura
  // tha: baqi sab mit jata aur LEDGER wahin reh jata -- kitabein aisi
  // booking ka udhaar aur aamdani dikhati rehtin jo ab maujood hi nahi.
  const { data: financialSummary, error: financialError } =
    await serviceClient.rpc("fn_reset_test_financials");
  if (financialError) errors.push(`machinery aur ledger: ${financialError.message}`);

  for (const table of TABLES_TO_CLEAR) await clear(table, "id");

  // Ginti ke khane `year` par khare hain, `id` par nahi.
  for (const table of COUNTER_TABLES) await clear(table, "year");


  if (errors.length > 0) {
    return { error: `Kuch tables clear nahi ho sakin: ${errors.slice(0, 5).join(" | ")}${errors.length > 5 ? "..." : ""}` };
  }

  revalidatePath("/admin/reset-test-data");
  return { success: true, notice: typeof financialSummary === "string" ? financialSummary : undefined };
}

export async function lockLiveMode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const confirmText = String(formData.get("confirm_text") ?? "");
  if (confirmText !== "WE ARE LIVE") {
    return { error: "Confirmation text sahi nahi hai. Bilkul 'WE ARE LIVE' likhein." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("platform_settings").upsert({ key: "is_live", value: true, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath("/admin/reset-test-data");
  return { success: true };
}