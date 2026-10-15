import { createServiceClient } from "@/lib/supabase/service";
import { buildRows, newCustomerOwners, periodRange, pkDate, type Period, type Row, type Staff } from "./achievement";

const VOID = ["cancelled", "void", "voided", "returned", "refunded"];
const RECOVERY_KINDS = ["customer_se_wasooli", "kisan_se_wapas"];
const EXCLUDED = new Set(["owner", "super_admin", "admin"]);

export type AchievementData = { rows: Row[]; period: Period; start: string; end: string; settingsMissing: boolean; truncated: boolean };

/** Sirf parhna -- POS/sales aur recovery ka maujooda data. */
export async function loadAchievement(orgId: string, period: Period, onlyProfileId?: string): Promise<AchievementData> {
  const db = createServiceClient() as any;
  const { start, end } = periodRange(period, pkDate(new Date()));
  const startTs = `${start}T00:00:00+05:00`, endTs = `${end}T00:00:00+05:00`;
  let staffQ = db.from("profiles").select("id,full_name,role").eq("organization_id", orgId).eq("is_active", true);
  if (onlyProfileId) staffQ = staffQ.eq("id", onlyProfileId);
  const { data: staffRows, error: se } = await staffQ;
  if (se) throw new Error(se.message);
  const staff = ((staffRows ?? []) as Staff[]).filter((s) => onlyProfileId || !EXCLUDED.has(String(s.role)));
  const ids = staff.map((s) => s.id);
  if (!ids.length) return { rows: [], period, start, end, settingsMissing: false, truncated: false };

  const LIMIT = 20000;
  const [salesR, catR, recR, tgtR, ruleR, setR] = await Promise.all([
    db.from("pos_sales").select("id,created_by,created_at,total_amount,khata_amount,payment_mode,customer_id,crm_customer_id,status").in("created_by", ids).gte("created_at", startTs).lt("created_at", endTs).limit(LIMIT),
    db.from("v_ai_sales_category").select("staff_id,category_name,sales_amount").in("staff_id", ids).gte("sale_date", start).lt("sale_date", end).limit(LIMIT),
    db.from("company_expense_requests").select("requested_by,amount,kind").in("requested_by", ids).in("kind", RECOVERY_KINDS).eq("status", "approved").gte("expense_date", start).lt("expense_date", end).limit(LIMIT),
    db.from("staff_achievement_targets").select("profile_id,role,period,target_amount").eq("organization_id", orgId).eq("is_active", true),
    db.from("staff_bonus_rules").select("period,basis,min_achievement_pct,bonus_type,bonus_value,title").eq("organization_id", orgId).eq("is_active", true),
    db.from("staff_performance_settings").select("low_performance_pct").eq("organization_id", orgId).maybeSingle(),
  ]);
  for (const r of [salesR, catR, recR]) if (r.error) throw new Error(r.error.message);
  const settingsMissing = Boolean(tgtR.error || ruleR.error || setR.error);
  const sales = ((salesR.data ?? []) as any[]).filter((s) => !VOID.includes(String(s.status ?? "completed"))).map((s) => ({ ...s, customer_id: s.crm_customer_id ?? s.customer_id }));
  const saleIds = sales.map((s) => s.id);
  const customerIds = Array.from(new Set(sales.map((s) => s.customer_id).filter(Boolean))) as string[];
  const [payR, earlierR, earlierCrmR] = await Promise.all([
    saleIds.length ? db.from("pos_sale_payment_details").select("sale_id,amount,payment_method").in("sale_id", saleIds).limit(LIMIT * 2) : { data: [], error: null },
    customerIds.length ? db.from("pos_sales").select("customer_id").in("customer_id", customerIds).lt("created_at", startTs).limit(LIMIT) : { data: [], error: null },
    customerIds.length ? db.from("pos_sales").select("crm_customer_id").in("crm_customer_id", customerIds).lt("created_at", startTs).limit(LIMIT) : { data: [], error: null },
  ]);
  if (payR.error) throw new Error(payR.error.message);
  const earlier = new Set<string>([...(earlierR.data ?? []).map((r: any) => r.customer_id), ...(earlierCrmR.data ?? []).map((r: any) => r.crm_customer_id)].filter(Boolean));
  const rows = buildRows({
    staff, period, sales, payments: payR.data ?? [], categories: catR.data ?? [], recovery: recR.data ?? [],
    newCustomerIds: newCustomerOwners(sales, earlier),
    targets: tgtR.error ? [] : tgtR.data ?? [], rules: ruleR.error ? [] : ruleR.data ?? [],
    lowPerformancePct: setR.error || setR.data?.low_performance_pct == null ? null : Number(setR.data.low_performance_pct),
  });
  return { rows, period, start, end, settingsMissing, truncated: (salesR.data ?? []).length >= LIMIT };
}
