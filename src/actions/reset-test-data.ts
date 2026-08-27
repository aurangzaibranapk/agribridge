"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// Every table that gets wiped by "Reset Test Data". Products, Categories,
// Brands, Companies, Staff (profiles), Organizations, Branches, Shops,
// Warehouses, Website CMS, and Settings/Config tables are intentionally
// NOT in this list — they survive every reset.
const TABLES_TO_CLEAR = [
  // AgriBridge Ordering
  "agri_complaint_counters", "agri_complaints", "agri_deliveries", "agri_dispatch_counters",
  "agri_dispatch_items", "agri_dispatches", "agri_feedback", "agri_grn_counters", "agri_grn_items",
  "agri_grns", "agri_order_counters", "agri_order_items", "agri_order_payments", "agri_order_timeline",
  "agri_orders", "agri_payment_counters", "bridge_order_items", "bridge_orders",
  // AI
  "ai_crop_reports", "ai_purchase_suggestions", "bridge_ai_action_requests", "bridge_ai_activity_log",
  // Logs
  "activity_logs", "application_activity_log", "audit_logs", "notifications",
  // HR
  "attendance_records", "interview_scores", "job_applications", "job_offers", "job_vacancies",
  "salary_payments", "staff_credit_ledger", "staff_details", "staff_messages", "staff_product_permissions",
  // Finance
  "branch_credit_accounts", "branch_credit_transactions", "capital_injections", "company_expense_counters",
  "company_expense_requests", "credit_requests", "finance_accounts", "finance_transactions",
  "khata_accounts", "khata_transactions", "payments", "wallet_transactions", "wallets",
  "escrow_transactions", "replacement_fund_withdrawals",
  // CRM
  "buyers", "buyer_payments", "customers", "customer_ledger", "dealers", "dealer_customers",
  "dealer_inventory", "dealer_payments", "dealer_payouts", "dealer_service_areas", "dealer_users",
  "investors", "investor_inquiries", "investor_investments", "investor_returns", "investment_deals",
  "investment_ledger", "suppliers", "supplier_payments", "supplier_payment_requests",
  "supplier_payment_request_counters", "company_reps",
  // Farmers/Farm
  "farmers", "farms", "farm_visits", "farmer_credit_balances", "farmer_credit_ledger",
  "farmer_produce_payouts", "crop_diagnoses", "crop_expenses", "crop_history",
  "crop_product_recommendations", "harvest_records", "soil_test_records", "water_test_records",
  "produce_listings", "produce_orders",
  // Agri Inputs
  "fertilizer_items", "fertilizer_requests", "livestock_loans", "machinery_requests",
  // Dairy
  "milk_entries", "milk_farmer_balances", "milk_payments", "milk_route_collections",
  "milk_type_migrations", "generator_logs", "fuel_logs", "maintenance_logs", "monthly_expenses",
  // Grain
  "grain_farmer_balances", "grain_procurement_entries", "grain_procurement_payments",
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

  for (const table of TABLES_TO_CLEAR) {
    const { error } = await serviceClient.from(table).delete().not("id", "is", null);
    if (error) errors.push(`${table}: ${error.message}`);
  }

  if (errors.length > 0) {
    return { error: `Kuch tables clear nahi ho sakin: ${errors.slice(0, 5).join(" | ")}${errors.length > 5 ? "..." : ""}` };
  }

  revalidatePath("/admin/reset-test-data");
  return { success: true };
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