import { createServiceClient } from "@/lib/supabase/service";

/**
 * Paisa kahan se nikal raha hai.
 *
 * Step 1 se 7 tak har cheez apni jagah hai. Ye safha koi naya data nahi
 * banata -- wo sab jorta hai aur ek sawal ka jawab deta hai jo malik
 * asal mein poochta hai: "sab se bara sooraakh kahan hai?"
 *
 * Is safhe ki poori qeemat EK farq par khari hai:
 *
 *     JO NAZAR AA RAHA HAI          vs      JAHAN HUM NE DEKHA HI NAHI
 *
 * Godam kabhi gina hi na gaya ho to "stock ka nuqsan" Rs 0 dikhega. Ye
 * adad theek hai -- aur bilkul jhoota bhi. Us ka matlab "koi nuqsan
 * nahi" nahi, "hum ne dekha hi nahi" hai. Dono ko ek jaisa dikhana wohi
 * ghalti hai jis se poora system bekaar ho jata hai: jitni kam jaanch
 * hogi, dashboard utna hi sabz nazar aayega.
 *
 * Is liye yahan do alag hisse hain, aur doosre ka khali hona hi maqsad
 * hai.
 */

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

const LEAK_ACCOUNTS = [
  { code: "6100", label: "Cash ka farq", where: "Roz ki cash ginti", href: "/admin/cash-close" },
  { code: "6110", label: "Stock ka nuqsan", where: "Godam ki ginti", href: "/admin/stock-count" },
  { code: "6120", label: "Doodh ka nuqsan", where: "Maidan se chiller tak", href: "/admin/quantity-money" },
  { code: "6130", label: "Grain ka nuqsan", where: "Khareed se bikri tak", href: "/admin/quantity-money" },
] as const;

export interface Leak {
  code: string;
  label: string;
  where: string;
  href: string;
  amount: number;
  /** Pichhle mahine ke muqable. Musbat = barh raha hai. */
  change: number | null;
}

export interface BlindSpot {
  key: string;
  title: string;
  detail: string;
  href: string;
  /** Kitni cheezon par nazar nahi -- godam, din, waghera. */
  count: number;
}

export interface Stuck {
  label: string;
  amount: number;
  detail: string;
  href: string;
}

export interface Attribution {
  label: string;
  amount: number;
  count: number;
}

export interface LeakageReport {
  month: number;
  year: number;
  leaks: Leak[];
  totalMeasured: number;
  previousTotal: number;
  blindSpots: BlindSpot[];
  stuck: Stuck[];
  totalStuck: number;
  byBranch: Attribution[];
  byPerson: Attribution[];
  /** Is mahine ka kul kharcha -- taake nuqsan ka paimana samajh aaye. */
  monthExpense: number;
}

function monthBounds(month: number, year: number) {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10),
    to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

/** Kisi khate ka us mahine ka jama shuda adad. */
async function accountTotal(code: string, month: number, year: number): Promise<number> {
  const service = createServiceClient();
  const { from, to } = monthBounds(month, year);
  const { data } = await service
    .from("journal_lines")
    .select("debit, credit, journal_entries!inner(entry_date)")
    .eq("account_code", code)
    .gte("journal_entries.entry_date", from)
    .lte("journal_entries.entry_date", to);

  return round2((data ?? []).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
}

/** Kisi khate ka abhi tak ka balance (mahine se bandha hua nahi). */
async function accountBalance(code: string): Promise<number> {
  const service = createServiceClient();
  const { data } = await service
    .from("journal_lines")
    .select("debit, credit")
    .eq("account_code", code);
  return round2((data ?? []).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
}

/**
 * Wo jagahen jahan hum ne dekha hi nahi.
 *
 * Ye fehrist upar wale adad se ZYADA ahem hai. Upar wala adad batata hai
 * ke jahan hum ne dekha wahan kitna nikla; ye batati hai ke kahan kahan
 * hum ne dekha hi nahi -- aur wahan ka adad sifar isi liye hai.
 */
async function findBlindSpots(month: number, year: number): Promise<BlindSpot[]> {
  const service = createServiceClient();
  const spots: BlindSpot[] = [];

  const [{ data: overdueStock }, { data: missingClose }, { data: bankLines }, { data: booked }] =
    await Promise.all([
      service.from("v_stock_count_overdue").select("warehouse_name, din_guzray"),
      service.from("v_cash_close_missing").select("branch_name, close_date"),
      service.from("bank_statement_lines").select("id").limit(1),
      service
        .from("quantity_reconciliations")
        .select("stream")
        .eq("period_month", month)
        .eq("period_year", year),
    ]);

  const never = (overdueStock ?? []).filter((w) => Number(w.din_guzray ?? 0) >= 9999);
  if ((overdueStock ?? []).length > 0) {
    spots.push({
      key: "stock",
      title:
        never.length > 0
          ? `${never.length} godam kabhi gina hi nahi gaya`
          : `${(overdueStock ?? []).length} godam ki ginti arse se nahi hui`,
      detail:
        "Jab tak ginti nahi hoti, “Stock ka nuqsan” sifar dikhta rahega — aur wo sifar us ka matlab nahi ke nuqsan nahi hua.",
      href: "/admin/stock-count",
      count: (overdueStock ?? []).length,
    });
  }

  if ((missingClose ?? []).length > 0) {
    spots.push({
      key: "cash",
      title: `${(missingClose ?? []).length} din ki cash ginti nahi hui`,
      detail:
        "Un dinon cash hila magar raat ko gina nahi gaya. Us din ka farq ab kabhi maloom nahi ho sakta.",
      href: "/admin/cash-close",
      count: (missingClose ?? []).length,
    });
  }

  if ((bankLines ?? []).length === 0) {
    spots.push({
      key: "bank",
      title: "Bank statement kabhi daali hi nahi gayi",
      detail:
        "Bank ka apna khata hamare khate se alag ho sakta hai. Jab tak statement nahi aati, wo farq nazar hi nahi aayega.",
      href: "/admin/bank-reconcile",
      count: 1,
    });
  }

  const bookedStreams = new Set((booked ?? []).map((b) => b.stream));
  const unbooked = ["milk", "grain"].filter((s) => !bookedStreams.has(s));
  if (unbooked.length > 0) {
    spots.push({
      key: "quantity",
      title: "Is mahine ki miqdar ka nuqsan alag nahi kiya gaya",
      detail:
        "Uthaya hua aur pahuncha hua maal ka farq abhi “khareed” ke andar chhupa hua hai, apne khane mein nahi.",
      href: "/admin/quantity-money",
      count: unbooked.length,
    });
  }

  return spots;
}

/**
 * Wo paisa jo abhi kahin atka hua hai.
 *
 * Ye nuqsan nahi -- abhi tak. Magar jitna waqt guzarta hai, utna ye kam
 * mumkin hota jata hai ke wo wapas aaye. Is liye ise nuqsan se alag,
 * magar sath rakha jata hai.
 */
async function findStuck(): Promise<Stuck[]> {
  const service = createServiceClient();
  const stuck: Stuck[] = [];

  const [withPerson, inBank, suspense, { data: transit }] = await Promise.all([
    accountBalance("1030"),
    accountBalance("1020"),
    accountBalance("9999"),
    service.from("v_cash_in_transit").select("din_guzray, le_jane_wala, lene_wala"),
  ]);

  if (withPerson !== 0) {
    const rows = transit ?? [];
    const oldest = rows.reduce((max, r) => Math.max(max, Number(r.din_guzray ?? 0)), 0);
    stuck.push({
      label: "Cash kisi ke haath mein",
      amount: Math.abs(withPerson),
      detail:
        rows.length > 0
          ? `${rows.length} handover ki tasdeeq baqi hai${oldest > 0 ? `, sab se purana ${oldest} din se` : ""}.`
          : "Tasdeeq baqi hai.",
      href: "/admin/cash-handover",
    });
  }

  if (inBank !== 0) {
    stuck.push({
      label: "Bank bheja, pahuncha nahi",
      amount: Math.abs(inBank),
      detail: "Ek taraf ka qadam darj hai, doosra nahi — ya jama hona baqi hai, ya entry reh gayi hai.",
      href: "/admin/money-trail?account=1020",
    });
  }

  if (suspense !== 0) {
    stuck.push({
      label: "Wajah abhi maloom nahi (Suspense)",
      amount: Math.abs(suspense),
      detail: "Is khate mein kuch bhi hona ek kaam hai jo abhi baqi hai.",
      href: "/admin/money-trail?account=9999",
    });
  }

  return stuck;
}

/** Farq kis branch mein nikal raha hai. */
async function branchAttribution(month: number, year: number): Promise<Attribution[]> {
  const service = createServiceClient();
  const { from, to } = monthBounds(month, year);

  const { data } = await service
    .from("cash_closings")
    .select("difference, branches(name)")
    .neq("difference", 0)
    .gte("close_date", from)
    .lte("close_date", to);

  const totals = new Map<string, { amount: number; count: number }>();
  for (const row of data ?? []) {
    const name = (row.branches as { name: string } | null)?.name ?? "—";
    const current = totals.get(name) ?? { amount: 0, count: 0 };
    current.amount += Math.abs(Number(row.difference ?? 0));
    current.count += 1;
    totals.set(name, current);
  }

  return [...totals.entries()]
    .map(([label, v]) => ({ label, amount: round2(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Kam pahuncha hua cash kis ke haath se guzra tha.
 *
 * Ye ilzam nahi hai. Ek dafa kam pahunchna har kisi ke sath ho sakta
 * hai. Magar agar wohi naam har mahine aata rahe, to wo baat khud ba
 * khud sawal ban jati hai -- aur wo sawal tabhi ban sakta hai jab naam
 * darj ho.
 */
async function personAttribution(month: number, year: number): Promise<Attribution[]> {
  const service = createServiceClient();
  const { from, to } = monthBounds(month, year);

  const { data } = await service
    .from("cash_handovers")
    .select(
      "difference, sent_at, carrier:profiles!cash_handovers_carrier_profile_id_fkey(full_name), sender:profiles!cash_handovers_from_profile_id_fkey(full_name)"
    )
    .eq("status", "short")
    .gte("sent_at", from)
    .lte("sent_at", `${to}T23:59:59`);

  const totals = new Map<string, { amount: number; count: number }>();
  for (const row of data ?? []) {
    const carrier = (row.carrier as { full_name: string | null } | null)?.full_name;
    const sender = (row.sender as { full_name: string | null } | null)?.full_name;
    const name = carrier ?? sender ?? "—";
    const current = totals.get(name) ?? { amount: 0, count: 0 };
    current.amount += Math.abs(Number(row.difference ?? 0));
    current.count += 1;
    totals.set(name, current);
  }

  return [...totals.entries()]
    .map(([label, v]) => ({ label, amount: round2(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount);
}

export async function leakageReport(month: number, year: number): Promise<LeakageReport> {
  const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };

  const [current, previous, blindSpots, stuck, byBranch, byPerson, expenseRows] = await Promise.all([
    Promise.all(LEAK_ACCOUNTS.map((a) => accountTotal(a.code, month, year))),
    Promise.all(LEAK_ACCOUNTS.map((a) => accountTotal(a.code, prev.m, prev.y))),
    findBlindSpots(month, year),
    findStuck(),
    branchAttribution(month, year),
    personAttribution(month, year),
    (async () => {
      const service = createServiceClient();
      const { from, to } = monthBounds(month, year);
      const { data } = await service
        .from("journal_lines")
        .select("debit, credit, gl_accounts!inner(account_type), journal_entries!inner(entry_date)")
        .eq("gl_accounts.account_type", "expense")
        .gte("journal_entries.entry_date", from)
        .lte("journal_entries.entry_date", to);
      return round2((data ?? []).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
    })(),
  ]);

  const leaks: Leak[] = LEAK_ACCOUNTS.map((a, i) => ({
    code: a.code,
    label: a.label,
    where: a.where,
    href: a.href,
    amount: current[i],
    change: previous[i] === 0 && current[i] === 0 ? null : round2(current[i] - previous[i]),
  })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  return {
    month,
    year,
    leaks,
    totalMeasured: round2(current.reduce((s, v) => s + v, 0)),
    previousTotal: round2(previous.reduce((s, v) => s + v, 0)),
    blindSpots,
    stuck,
    totalStuck: round2(stuck.reduce((s, v) => s + v.amount, 0)),
    byBranch,
    byPerson,
    monthExpense: expenseRows,
  };
}
