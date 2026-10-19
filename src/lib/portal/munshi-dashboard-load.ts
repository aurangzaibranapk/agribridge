import { createServiceClient } from "@/lib/supabase/service";
import { computeProfileCompletion } from "@/lib/utils/farmer-profile";
import {
  addToMonths,
  buildTasks,
  countFertilizer,
  countMachinery,
  dedupeCrops,
  groupKhataByDay,
  mergeActivity,
  milkDaily,
  monthBuckets,
  officialScore,
  summarizeKhata,
  summarizeLivestock,
  dairyLitersPerDay,
  summarizeProfit,
  type ActivityItem,
  type CreditPositionRow,
} from "./munshi-dashboard";

/**
 * Dashboard ka sara data -- SIRF is kisan ka.
 *
 * Kai cheezein staff ke liye band hain (customers, journal, credit
 * position, doodh ke khate). Kisan ko apna hi hisaab dikhane ke liye yahan
 * service client lagta hai -- magar har query ka darwaza `farmerId` hai,
 * jo login session se nikla (layout/page `farmers.user_id = auth.uid()`
 * se dhoondta hai). Bahar se koi id andar nahi aati. Customer ids bhi
 * isi farmer_id se nikalti hain, kisi form se nahi.
 */
export async function loadMunshiDashboard(farmer: Record<string, any>, now = new Date()) {
  const farmerId: string = farmer.id;
  if (!farmerId) throw new Error("farmer id missing");
  const sb = createServiceClient() as any;
  const today = now.toISOString().slice(0, 10);
  const since180 = new Date(now.getTime() - 185 * 86_400_000).toISOString().slice(0, 10);

  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [farmsR, customersR, fclR, milkR, milkPayR, milkBalR, grainBalR, creditReqR, bookingsR, demandsR, loansR, campaignsR, campBookR, snapR, eligR, dairyAnimalsR, dairyYieldsR] =
    await Promise.all([
      sb.from("farms").select("id, name, area_acres, latitude, longitude, is_verified").eq("farmer_id", farmerId).order("created_at"),
      sb.from("customers").select("id, current_balance, credit_limit, is_deleted").eq("farmer_id", farmerId),
      sb.from("farmer_credit_ledger").select("ledger_type, amount, created_at, source_type").eq("farmer_id", farmerId),
      sb.from("milk_entries").select("entry_date, quantity_liters, total_amount, rate_per_liter").eq("farmer_id", farmerId).gte("entry_date", since180),
      sb.from("milk_payments").select("amount, payment_date").eq("farmer_id", farmerId).gte("payment_date", since180),
      sb.from("milk_farmer_balances").select("balance_due, total_supplied").eq("farmer_id", farmerId).maybeSingle(),
      sb.from("grain_farmer_balances").select("balance_due").eq("farmer_id", farmerId).maybeSingle(),
      sb.from("credit_requests").select("status, created_at, category, total_amount, products(name)").eq("farmer_id", farmerId).order("created_at", { ascending: false }),
      sb.from("machinery_bookings").select("status, booking_date, created_at, booking_number, crop_type, harvest_area").eq("farmer_id", farmerId).order("created_at", { ascending: false }),
      sb.from("farmer_product_demands").select("product_name, quantity, unit, created_at, status").eq("farmer_id", farmerId).order("created_at", { ascending: false }).limit(20),
      sb.from("livestock_loans").select("loan_amount, created_at, cow_count, buffalo_count, goat_count").eq("farmer_id", farmerId),
      sb.from("booking_campaigns").select("id, name, crop, deadline, is_active").eq("is_active", true).order("deadline"),
      sb.from("campaign_bookings").select("campaign_id, acres, created_at").eq("farmer_id", farmerId),
      sb.from("score_snapshots").select("score, band, state, snapshot_date").eq("subject_type", "farmer").eq("subject_id", farmerId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
      sb.rpc("fn_credit_eligibility", { p_subject_type: "farmer", p_subject_id: farmerId }),
      // Livestock -> Dairy: Dairy Management ke janwar aur doodh -- hon to dashboard inhi ko dikhaye.
      sb.from("dairy_animals").select("species, status").eq("farmer_id", farmerId),
      sb.from("dairy_milk_yields").select("yield_date, liters").eq("farmer_id", farmerId).gte("yield_date", since30),
    ]);

  const farms: any[] = farmsR.data ?? [];
  const farmIds = farms.map((f) => f.id);
  const customers: any[] = (customersR.data ?? []).filter((c: any) => !c.is_deleted);
  const customerIds = customers.map((c) => c.id);

  const [cropsR, harvestsR, positions, linesR] = await Promise.all([
    farmIds.length
      ? sb.from("crop_history").select("id, farm_id, crop_name, sowing_date, expected_harvest_date, farms(name)").in("farm_id", farmIds).order("sowing_date", { ascending: false })
      : { data: [] },
    farmIds.length
      ? sb.from("harvest_records").select("id, farm_id, crop_name, harvest_date, quantity_harvested, sale_rate, total_expense, created_at").in("farm_id", farmIds)
      : { data: [] },
    Promise.all(
      customerIds.map(async (id) => {
        const { data } = await sb.rpc("fn_customer_credit_position", { p_customer: id });
        return (Array.isArray(data) ? data[0] : data) as CreditPositionRow | undefined;
      })
    ),
    customerIds.length
      ? sb
          .from("journal_lines")
          .select("debit, credit, memo, journal_entries!inner(entry_date, description, source_module)")
          .eq("account_code", "1100")
          .eq("party_type", "customer")
          .in("party_id", customerIds)
          .limit(5000)
      : { data: [] },
  ]);

  const crops: any[] = dedupeCrops((cropsR.data ?? []) as any[]);
  const cropIds = crops.map((c) => c.id);
  const { data: expRows } = cropIds.length
    ? await sb.from("crop_expenses").select("amount, expense_date, created_at").in("crop_history_id", cropIds)
    : { data: [] };

  const lines = ((linesR.data ?? []) as any[]).map((l) => ({
    date: String(l.journal_entries?.entry_date ?? ""),
    debit: Number(l.debit ?? 0),
    credit: Number(l.credit ?? 0),
  }));
  const journalNet = linesR.error ? null : lines.reduce((s, l) => s + l.debit - l.credit, 0);
  const fcl: any[] = fclR.data ?? [];
  const farmerLedgerDue = fcl.reduce((s, r) => s + (r.ledger_type === "debit" ? Number(r.amount) : -Number(r.amount)), 0);

  const khata = summarizeKhata({
    positions: positions.filter(Boolean) as CreditPositionRow[],
    customerBalances: customers.map((c) => Number(c.current_balance ?? 0)),
    journalNet,
    farmerLedgerDue,
    milkPayable: Number(milkBalR.data?.balance_due ?? 0),
    grainPayable: Number(grainBalR.data?.balance_due ?? 0),
  });

  const creditLimit = Math.max(Number(farmer.credit_limit ?? 0), ...customers.map((c) => Number(c.credit_limit ?? 0)), 0);
  const livestock = summarizeLivestock(farmer, dairyAnimalsR?.data ?? [], dairyLitersPerDay(dairyYieldsR?.data ?? []));
  const milk: any[] = milkR.data ?? [];
  const milkDays = milkDaily(now, milk, 30);
  const milk30 = milkDays.reduce((s, d) => s + d.liters, 0);
  const milkToday = milkDays[milkDays.length - 1]?.liters ?? 0;
  const lastRate = milk.find((m) => m.rate_per_liter)?.rate_per_liter ?? farmer.milk_sale_rate ?? null;

  const harvests: any[] = harvestsR.data ?? [];
  const profit = summarizeProfit({
    harvests,
    cropExpenses: (expRows ?? []).map((e: any) => Number(e.amount)),
    milkIncome: milk.reduce((s, m) => s + Number(m.total_amount ?? 0), 0),
  });

  const fert = countFertilizer(creditReqR.data ?? []);
  const mach = countMachinery(bookingsR.data ?? []);

  const months = monthBuckets(now, 6);
  addToMonths(months, "udhaar", [
    ...lines.map((l) => ({ date: l.date, amount: l.debit })),
    ...fcl.filter((r) => r.ledger_type === "debit").map((r) => ({ date: r.created_at, amount: r.amount })),
  ]);
  addToMonths(months, "adaigi", [
    ...lines.map((l) => ({ date: l.date, amount: l.credit })),
    ...fcl.filter((r) => r.ledger_type === "credit").map((r) => ({ date: r.created_at, amount: r.amount })),
  ]);
  addToMonths(months, "milk", milk.map((m) => ({ date: m.entry_date, amount: m.total_amount })));
  addToMonths(months, "kharcha", (expRows ?? []).map((e: any) => ({ date: e.expense_date ?? e.created_at, amount: e.amount })));

  const act: ActivityItem[][] = [
    groupKhataByDay(lines).flatMap((d) => [
      ...(d.debit > 0 ? [{ kind: "khata_udhaar" as const, title: "", detail: String(d.count), date: d.date, amount: d.debit }] : []),
      ...(d.credit > 0 ? [{ kind: "khata_adaigi" as const, title: "", detail: "", date: d.date, amount: d.credit }] : []),
    ]),
    milk.map((m) => ({ kind: "milk" as const, title: "", detail: `${Number(m.quantity_liters)} L`, date: m.entry_date, amount: Number(m.total_amount ?? 0) })),
    (milkPayR.data ?? []).map((p: any) => ({ kind: "milk_payment" as const, title: "", detail: "", date: p.payment_date, amount: Number(p.amount) })),
    (creditReqR.data ?? []).map((r: any) => ({ kind: "fertilizer" as const, title: "", detail: r.products?.name ?? r.category ?? "", date: r.created_at, amount: Number(r.total_amount ?? 0) })),
    (bookingsR.data ?? []).map((b: any) => ({ kind: "machinery" as const, title: "", detail: [b.booking_number, b.crop_type, b.harvest_area ? `${b.harvest_area} acre` : null].filter(Boolean).join(" · "), date: b.created_at ?? b.booking_date })),
    (demandsR.data ?? []).map((d: any) => ({ kind: "demand" as const, title: "", detail: `${d.product_name ?? ""} · ${Number(d.quantity ?? 0)} ${d.unit ?? ""}`.trim(), date: d.created_at })),
    crops.filter((c) => c.sowing_date).map((c) => ({ kind: "crop" as const, title: "", detail: `${c.crop_name}${c.farms?.name ? ` · ${c.farms.name}` : ""}`, date: c.sowing_date })),
    harvests.map((h) => ({ kind: "harvest" as const, title: "", detail: `${h.crop_name ?? ""} · ${Number(h.quantity_harvested ?? 0)}`, date: h.harvest_date ?? h.created_at })),
    (loansR.data ?? []).map((l: any) => ({ kind: "livestock_loan" as const, title: "", detail: "", date: l.created_at, amount: Number(l.loan_amount ?? 0) })),
    (campBookR.data ?? []).map((b: any) => ({ kind: "campaign" as const, title: "", detail: `${Number(b.acres ?? 0)} acre`, date: b.created_at })),
  ];
  const activity = mergeActivity(act, 8);

  const completion = computeProfileCompletion(farmer as any);
  const myCampaignIds = new Set((campBookR.data ?? []).map((b: any) => b.campaign_id));
  const openCampaigns = ((campaignsR.data ?? []) as any[]).filter((c) => !c.deadline || c.deadline.slice(0, 10) >= today);
  const tasks = buildTasks({
    today,
    khata,
    fert,
    mach,
    profileComplete: completion.isComplete,
    farmsWithoutPin: farms.filter((f) => f.latitude == null || f.longitude == null).map((f) => f.name),
    campaigns: openCampaigns.filter((c) => !myCampaignIds.has(c.id)).map((c) => ({ name: c.name, deadline: c.deadline })),
  });

  // Har farm ki abhi wali fasal: sab se nayi kasht.
  const currentCrop = new Map<string, string>();
  for (const c of crops) if (c.farm_id && !currentCrop.has(c.farm_id)) currentCrop.set(c.farm_id, c.crop_name);

  const eligRow = Array.isArray(eligR.data) ? eligR.data[0] : null;

  return {
    today,
    completion,
    khata,
    creditLimit,
    livestock,
    milk: { days: milkDays, total30: milk30, today: milkToday, rate: lastRate ? Number(lastRate) : null, hasRecord: milk.length > 0 },
    farms: farms.map((f) => ({ id: f.id, name: f.name, acres: Number(f.area_acres ?? 0), pinned: f.latitude != null && f.longitude != null, verified: !!f.is_verified, crop: currentCrop.get(f.id) ?? null })),
    totalAcres: farms.reduce((s, f) => s + Number(f.area_acres ?? 0), 0) || Number(farmer.land_size_acres ?? 0),
    crops: { count: crops.length, byName: Object.entries(crops.reduce((m: Record<string, number>, c) => ((m[c.crop_name] = (m[c.crop_name] ?? 0) + 1), m), {})) as [string, number][] },
    profit,
    fert,
    mach,
    months,
    activity,
    tasks,
    // Udhaar ab sirf season plans (Gandum, phir Munji) se -- dashboard card yahi dikhata hai.
    booking: {
      mine: (campBookR.data ?? []).length,
      acres: (campBookR.data ?? []).reduce((s: number, b: any) => s + Number(b.acres ?? 0), 0),
      open: openCampaigns.length,
    },
    campaign: openCampaigns[0] ? { name: openCampaigns[0].name as string, deadline: openCampaigns[0].deadline as string | null } : null,
    score: officialScore(snapR.data ?? null, eligRow ?? null),
    allCrops: crops,
  };
}

export type MunshiDashboardData = Awaited<ReturnType<typeof loadMunshiDashboard>>;
