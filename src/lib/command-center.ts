import { createServiceClient } from "@/lib/supabase/service";
import { loadCostSheet } from "@/lib/milk-cost-per-liter";

/**
 * Owner Command Center ke aankre.
 *
 * Yahan har adad kisi asal khane se aata hai -- koi andaza nahi. Jo
 * cheez maujooda data se nahi nikalti, wo "—" rehti hai. Dashboard par
 * ghalat adad likhna khali khane se kahin bura hota: khali khana sawal
 * paida karta hai, ghalat adad faisla badal deta hai.
 *
 * Isi wajah se har department ka wohi paimana liya gaya hai jo us ke
 * apne khaton mein waqai maujood hai:
 *
 *   Retail    -- pos_sales mein nafa khud likha hota hai
 *   Grain     -- grain_sales mein nafa aur lagat dono maujood hain
 *   Machinery -- booking par commission, diesel aur vendor ka hissa
 *   Milk      -- doodh KHAREEDA jata hai, is liye ye kharcha hai;
 *                us ki bikri alag khane mein hai jo abhi khali hai
 */

export interface DeptKpi {
  key: string;
  label: string;
  /** Aamdani -- na nikal sake to null. */
  revenue: number | null;
  /** Kharcha ya lagat. */
  cost: number | null;
  /** Nafa -- sirf tab jab dono asal mein maujood hon. */
  profit: number | null;
  /** Ek line mein wo cheez jo is department ko sab se zyada bayan karti hai. */
  volumeLabel: string;
  volume: string;
  /** Jo kaam pare hue hain. */
  pending: number;
  /** Wo cheez jo abhi is khane se nahi nikalti. */
  note: string | null;
}

export interface MoneyToday {
  revenue: number;
  expenses: number;
  net: number;
  cash: number;
  receivable: number | null;
  payable: number | null;
}

export interface Alert {
  tone: "red" | "amber" | "green";
  title: string;
  detail: string;
  href: string;
}

function n(value: unknown): number {
  return Number(value ?? 0);
}

function sumOf<T extends Record<string, unknown>>(rows: T[] | null, column: keyof T): number {
  return (rows ?? []).reduce((total, row) => total + n(row[column]), 0);
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadMoneyToday(): Promise<MoneyToday> {
  const service = createServiceClient();
  const t = today();

  const [{ data: sales }, { data: grainSales }, { data: expenses }, { data: accounts }, { data: credit }] =
    await Promise.all([
      service.from("pos_sales").select("total_amount, profit").gte("created_at", t),
      service.from("grain_sales").select("total_amount, profit").eq("sale_date", t),
      service.from("company_expense_requests").select("amount").eq("status", "approved").gte("created_at", t),
      service.from("finance_accounts").select("current_balance").eq("is_active", true),
      service.from("branch_credit_transactions").select("transaction_type, amount"),
    ]);

  const revenue = sumOf(sales, "total_amount") + sumOf(grainSales, "total_amount");
  const spent = sumOf(expenses, "amount");
  // Nafa wahan se liya jata hai jahan wo pehle se gina hua hai, dobara
  // nahi ginte -- COGS ka hisaab har jagah thora alag hota hai aur do
  // jagah ginne se do alag adad nikal aate hain.
  const grossProfit = sumOf(sales, "profit") + sumOf(grainSales, "profit");

  // Shop ka bojh: charge barhata hai, adaigi ghatati hai. Wahi usool jo
  // /admin/branch-credit dikhata hai.
  let receivable: number | null = null;
  if (credit) {
    receivable = credit.reduce(
      (total, row) => (row.transaction_type === "payment" ? total - n(row.amount) : total + n(row.amount)),
      0
    );
  }

  return {
    revenue,
    expenses: spent,
    net: grossProfit - spent,
    cash: sumOf(accounts, "current_balance"),
    receivable,
    payable: null,
  };
}

export async function loadDeptKpis(): Promise<DeptKpi[]> {
  const service = createServiceClient();
  const from = monthStart();

  const [
    { data: pos },
    { data: grain },
    { data: grainBuy },
    { data: machinery },
    { data: milk },
    { data: pendingSubs },
    { data: pendingReturns },
    { data: pendingFat },
  ] = await Promise.all([
    service.from("pos_sales").select("total_amount, profit, total_cogs").gte("created_at", from),
    service.from("grain_sales").select("total_amount, profit, total_cogs, quantity_kg").gte("sale_date", from),
    service.from("grain_procurement_entries").select("total_amount, weight_kg").gte("entry_date", from),
    service
      .from("machinery_bookings")
      .select("total_amount, vendor_payable, diesel_amount, commission_amount")
      .gte("booking_date", from),
    service
      .from("milk_entries")
      .select("quantity_liters, total_amount")
      .gte("entry_date", from)
      .neq("status", "rejected"),
    service.from("whatsapp_submissions").select("id").eq("status", "pending"),
    service.from("agri_order_returns").select("id").eq("status", "pending"),
    service.from("milk_entries").select("id").eq("status", "pending_fat"),
  ]);

  const machineryRevenue = sumOf(machinery, "total_amount");
  const machineryCost = sumOf(machinery, "vendor_payable") + sumOf(machinery, "diesel_amount");

  return [
    {
      key: "milk",
      label: "Milk",
      revenue: null,
      cost: sumOf(milk, "total_amount"),
      profit: null,
      volumeLabel: "Doodh",
      volume: `${Math.round(sumOf(milk, "quantity_liters"))} L`,
      pending: (pendingFat ?? []).length,
      note: "Doodh khareeda jata hai — bikri ka khana abhi khali hai, is liye nafa nahi nikalta.",
    },
    {
      key: "grain",
      label: "Grain",
      revenue: sumOf(grain, "total_amount"),
      cost: sumOf(grainBuy, "total_amount"),
      profit: sumOf(grain, "profit"),
      volumeLabel: "Bika",
      volume: `${Math.round(sumOf(grain, "quantity_kg"))} kg`,
      pending: 0,
      note: null,
    },
    {
      key: "machinery",
      label: "Machinery",
      revenue: machineryRevenue,
      cost: machineryCost,
      profit: machineryRevenue - machineryCost,
      volumeLabel: "Booking",
      volume: String((machinery ?? []).length),
      pending: 0,
      note: null,
    },
    {
      key: "retail",
      label: "Retail",
      revenue: sumOf(pos, "total_amount"),
      cost: sumOf(pos, "total_cogs"),
      profit: sumOf(pos, "profit"),
      volumeLabel: "Bikri",
      volume: String((pos ?? []).length),
      pending: (pendingReturns ?? []).length,
      note: null,
    },
    {
      key: "approvals",
      label: "Approval",
      revenue: null,
      cost: null,
      profit: null,
      volumeLabel: "Intezar mein",
      volume: String((pendingSubs ?? []).length),
      pending: (pendingSubs ?? []).length,
      note: null,
    },
  ];
}

export async function loadAlerts(): Promise<Alert[]> {
  const service = createServiceClient();
  const alerts: Alert[] = [];
  const from = monthStart();

  const [{ data: redRoutes }, { data: subs }, { data: expenses }, { data: openLogs }, { data: dupMilk }] =
    await Promise.all([
      service
        .from("milk_route_collections")
        .select("route_name, collection_date, shortage_liters")
        .eq("is_red_alert", true)
        .gte("collection_date", from)
        .order("collection_date", { ascending: false })
        .limit(3),
      service.from("whatsapp_submissions").select("id").eq("status", "pending"),
      service.from("company_expense_requests").select("id").eq("status", "pending"),
      service.from("vehicle_daily_logs").select("id").not("opening_km", "is", null).is("closing_km", null).lt("log_date", today()),
      service.from("milk_entries").select("id").not("possible_duplicate_of", "is", null).neq("status", "rejected"),
    ]);

  for (const route of redRoutes ?? []) {
    alerts.push({
      tone: "red",
      title: `Doodh ki kami — ${route.route_name}`,
      detail: `${route.collection_date}: ${Math.abs(n(route.shortage_liters))} L ka farq, hadd se zyada.`,
      href: "/admin/milk-collection/routes",
    });
  }

  if ((subs ?? []).length > 0) {
    alerts.push({
      tone: "amber",
      title: `${(subs ?? []).length} entry approval ke intezar mein`,
      detail: "In par faisla hone tak paisa kisi khate mein nahi jata.",
      href: "/admin/submissions",
    });
  }

  if ((expenses ?? []).length > 0) {
    alerts.push({
      tone: "amber",
      title: `${(expenses ?? []).length} kharcha manzoori ke intezar mein`,
      detail: "Finance ne abhi in par faisla nahi kiya.",
      href: "/admin/company-expenses",
    });
  }

  if ((openLogs ?? []).length > 0) {
    alerts.push({
      tone: "red",
      title: `${(openLogs ?? []).length} gaari ka shaam wala meter nahi aaya`,
      detail: "Guzray hue dinon ka hisaab adhoora hai.",
      href: "/admin/field-watch",
    });
  }

  if ((dupMilk ?? []).length > 0) {
    alerts.push({
      tone: "amber",
      title: `${(dupMilk ?? []).length} doodh ki entry par duplicate ka nishan`,
      detail: "Usi kisan ki usi shift mein ek se zyada entry mili.",
      href: "/admin/milk-collection/verify",
    });
  }

  // ---- Fi litre ka hisaab adhoora to nahi? ----
  // Khali khana sifar ki tarah ginta hai, aur us se fi litre kharcha
  // ASAL SE KAM nazar aata hai -- yani munafa asal se ZYADA. Ye ghalti
  // chup rehti hai: safha bilkul theek nazar aata hai, bas adad chhota
  // hota hai. Is liye ye baat yahan bhi aati hai, us safhe par jane ka
  // intezar nahi kiya jata.
  const now = new Date();
  const sheet = await loadCostSheet(now.getMonth() + 1, now.getFullYear(), null);
  if (sheet.liters > 0 && sheet.missing.length > 0) {
    alerts.push({
      tone: sheet.missing.length >= 3 ? "red" : "amber",
      title: `Fi litre ka hisaab adhoora — ${sheet.missing.length} khane khali`,
      detail:
        `${sheet.missing.join(", ")} is mahine darj nahi huye. ` +
        `Abhi fi litre Rs ${(sheet.perLiterRunning ?? 0).toFixed(2)} dikh raha hai — asal is se zyada hoga.`,
      href: "/admin/milk-collection/cost-per-liter",
    });
  }

  // ---- Raat ki ginti chhoot to nahi rahi? ----
  // Jis din ginti nahi hui, us din ka farq kabhi maloom nahi hoga --
  // aur farq wahi ek cheez hai jo kaghaz aur golak ka faasla dikhati
  // hai. Ye baat safhe par jane ka intezar nahi kar sakti, kyunki
  // chhoote hue din khud koi shor nahi machate.
  const [{ data: missedDays }, { data: bigGaps }] = await Promise.all([
    service.from("v_cash_close_missing").select("branch_name, close_date"),
    service
      .from("cash_closings")
      .select("branch_id, close_date, difference, branches(name)")
      .neq("difference", 0)
      .gte("close_date", from)
      .order("close_date", { ascending: false })
      .limit(5),
  ]);

  if ((missedDays ?? []).length > 0) {
    const branchNames = Array.from(
      new Set((missedDays ?? []).map((d) => d.branch_name ?? "—"))
    );
    alerts.push({
      tone: (missedDays ?? []).length >= 3 ? "red" : "amber",
      title: `${(missedDays ?? []).length} din ki cash ginti nahi hui`,
      detail: `${branchNames.join(", ")} — un dinon cash hila magar raat ko gina nahi gaya. Us din ka farq ab maloom nahi ho sakta.`,
      href: "/admin/cash-close",
    });
  }

  const gapTotal = (bigGaps ?? []).reduce((sum, g) => sum + Math.abs(n(g.difference)), 0);
  if (gapTotal > 0) {
    alerts.push({
      tone: gapTotal >= 2000 ? "red" : "amber",
      title: `Cash ginti mein Rs ${Math.round(gapTotal).toLocaleString()} ka farq`,
      detail:
        `Is mahine ${(bigGaps ?? []).length} raat golak aur hisaab barabar nahi mile. ` +
        `Har farq "Cash ka farq" khate mein darj hai — kisi kharche mein chhupaya nahi gaya.`,
      href: "/admin/cash-close",
    });
  }

  // ---- Cash jo abhi kisi ke haath mein hai ----
  // Ye raqam "raaste mein" hai, gum nahi -- magar jitna waqt guzarta
  // hai, utna kam mumkin hota jata hai ke wo kabhi mile. Is liye din
  // ginte hain, sirf raqam nahi.
  const { data: inTransit } = await service
    .from("v_cash_in_transit")
    .select("amount_sent, din_guzray, lene_wala, le_jane_wala");

  const transitRows = inTransit ?? [];
  if (transitRows.length > 0) {
    const total = transitRows.reduce((sum, r) => sum + n(r.amount_sent), 0);
    const stale = transitRows.filter((r) => n(r.din_guzray) >= 2);
    const names = Array.from(
      new Set(stale.map((r) => r.le_jane_wala ?? r.lene_wala ?? "—"))
    );

    alerts.push({
      tone: stale.length > 0 ? "red" : "amber",
      title: `Rs ${Math.round(total).toLocaleString()} abhi kisi ke haath mein hai`,
      detail:
        stale.length > 0
          ? `${stale.length} raqam do ya us se zyada din se raaste mein hai — ${names.join(", ")}. Tasdeeq abhi tak nahi hui.`
          : `${transitRows.length} handover ki tasdeeq baqi hai.`,
      href: "/admin/cash-handover",
    });
  }

  // ---- Bank ki wo qataren jo hamare khate mein hain hi nahi ----
  const { data: bankGaps } = await service
    .from("bank_statement_lines")
    .select("amount")
    .eq("status", "unmatched");

  if ((bankGaps ?? []).length > 0) {
    const total = (bankGaps ?? []).reduce((sum, r) => sum + Math.abs(n(r.amount)), 0);
    alerts.push({
      tone: "amber",
      title: `Bank ki ${(bankGaps ?? []).length} qatar hamare khate mein nahi`,
      detail: `Rs ${Math.round(total).toLocaleString()} ka farq. Bank ghalat nahi hota — ye entriyan hamari taraf reh gayi hain.`,
      href: "/admin/bank-reconcile",
    });
  }

  // ---- Jin godamon ki ginti bohat arse se nahi hui ----
  // Kabhi na gina gaya godam sab se khatarnak hai: wahan farq ka jama
  // hona shuru se jari hai aur kisi ne dekha hi nahi. Maal chupke se
  // nikalna cash se aasan hota hai -- Rs 50,000 ghayab hon to raat ko
  // pakre jate hain, paanch bori khaad ghayab ho to koi ginta hi nahi.
  const { data: staleStock } = await service
    .from("v_stock_count_overdue")
    .select("warehouse_name, din_guzray");

  if ((staleStock ?? []).length > 0) {
    const never = (staleStock ?? []).filter((w) => n(w.din_guzray) >= 9999);
    const names = (staleStock ?? []).map((w) => w.warehouse_name ?? "—");
    alerts.push({
      tone: never.length > 0 ? "red" : "amber",
      title: `${(staleStock ?? []).length} godam ki ginti arse se nahi hui`,
      detail:
        never.length > 0
          ? `${never.length} godam to kabhi gina hi nahi gaya (${names.join(", ")}). Wahan farq ka jama hona shuru se jari hai.`
          : `${names.join(", ")} — ek mahine se zyada ho gaya.`,
      href: "/admin/stock-count",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      tone: "green",
      title: "Filhal koi cheez tawajjah nahi mangti",
      detail: "Na koi kami ka nishan, na koi faisla atka hua.",
      href: "/admin/field-watch",
    });
  }

  return alerts;
}

/**
 * Nateeja -- aankron se, andaze se nahi.
 *
 * Ye jaan boojh kar AI ko nahi bheja jata. Aankre pehle se maujood hain
 * aur un se seedha nateeja nikalta hai; beech mein AI daalne se sirf ye
 * khatra barhta hai ke wo koi aisi baat keh de jo aankron mein hai hi
 * nahi. Dashboard par likhi baat par faisla hota hai, is liye us ka har
 * lafz kisi khane se nikalna chahiye.
 */
export function conclude(depts: DeptKpi[]): string[] {
  const withProfit = depts.filter((d) => d.profit != null && (d.revenue ?? 0) > 0);
  if (withProfit.length === 0) {
    return ["Is mahine abhi itna kaam nahi hua ke departments ka moqabla kiya ja sake."];
  }

  const sorted = [...withProfit].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const lines: string[] = [];
  lines.push(
    `Sab se behtar: **${best.label}** — Rs ${Math.round(best.profit ?? 0).toLocaleString()} nafa, ` +
      `Rs ${Math.round(best.revenue ?? 0).toLocaleString()} ki aamdani par.`
  );

  if (sorted.length > 1 && worst.key !== best.key) {
    const margin = (worst.revenue ?? 0) > 0 ? ((worst.profit ?? 0) / (worst.revenue ?? 1)) * 100 : 0;
    lines.push(
      `Sab se kam: **${worst.label}** — margin ${margin.toFixed(1)}%. ` +
        `Lagat Rs ${Math.round(worst.cost ?? 0).toLocaleString()} hai; nafa isi se dabta hai.`
    );
  }

  const pending = depts.reduce((total, d) => total + d.pending, 0);
  if (pending > 0) {
    lines.push(`${pending} kaam faisle ke intezar mein pare hain — jab tak faisla nahi hota, hisaab adhoora rehta hai.`);
  }

  const noted = depts.filter((d) => d.note);
  for (const d of noted) lines.push(`${d.label}: ${d.note}`);

  return lines;
}
