import { createServiceClient } from "@/lib/supabase/service";

/**
 * Maali gosharay -- Trial Balance, Nafa Nuqsan, Balance Sheet, aur poora
 * journal.
 *
 * YAHAN KOI NAYA HISAAB NAHI BANTA. Ye chaaron us ek hi fehrist par
 * khaRe hain jo pehle se chal rahi hai: `journal_lines`. Har waqia --
 * POS ki bikri, supplier ki kharid, doodh, machinery, cash ka farq --
 * pehle se usi mein jata hai.
 *
 * Ye baat is liye likhi ja rahi hai ke ERP mein sab se aam aur sab se
 * mehngi ghalti yehi hoti hai: report ke liye adad ALAG se jama karna
 * shuru kar dena. Us ke baad do jagah do adad hote hain, dono theek
 * lagte hain, aur koi nahi bata sakta ke sahi kaunsa hai. Is liye yahan
 * sirf JAMA ho raha hai, gina kuch nahi ja raha.
 *
 * TEEN BAATEIN JO IN GOSHARON MEIN MAAYNE RAKHTI HAIN:
 *
 * 1. TRIAL BALANCE KA DONO TARAF BARABAR HONA. Ye is baat ki jaanch hai
 *    ke ledger apne andar se theek hai. Farq aaye to wo report ki ghalti
 *    nahi -- wo asal masla hai, aur usay chhupaya nahi jata.
 *
 * 2. BALANCE SHEET MEIN "IS SAAL KA NAFA". Nafa nuqsan ke khate saal ke
 *    aakhir mein sarmaye mein jate hain. Jab tak wo band na hon, balance
 *    sheet tab tak barabar nahi hoti jab tak is saal ka nafa alag se na
 *    dikhaya jaye. Isi liye wo qatar wahan maujood hai.
 *
 * 3. TAREEKH KI HADD. Nafa nuqsan hamesha DO tareekhon ke darmiyan ka
 *    hota hai; balance sheet hamesha EK tareekh par. Ye farq mita dene
 *    se dono adad bemani ho jate hain.
 */

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface GlAccount {
  code: string;
  name: string;
  account_type: AccountType;
  normal_side: "debit" | "credit";
  sort_order: number;
}

export interface TrialRow extends GlAccount {
  debit: number;
  credit: number;
  /** Us ke apne rukh par baqi (debit khate par debit-credit). */
  balance: number;
}

export interface TrialBalance {
  rows: TrialRow[];
  totalDebit: number;
  totalCredit: number;
  /** Sifar hona chahiye. Na ho to ye asal masla hai. */
  farq: number;
  /** Jawab hi na mil sake -- sifar se ALAG. */
  error?: string;
}

interface LineRow {
  account_code: string;
  debit: number | null;
  credit: number | null;
}

/**
 * Do tareekhon ke darmiyan har khate ka jama.
 *
 * `from` khali ho to shuru se -- balance sheet ke liye yehi chahiye hota
 * hai, kyunke asason aur zimmon ka baqi shuru se ab tak ka hota hai.
 */
async function lines(from: string | null, to: string, branchId?: string | null) {
  const service = createServiceClient();

  let q = service
    .from("journal_lines")
    .select("account_code, debit, credit, journal_entries!inner(entry_date, branch_id)")
    .lte("journal_entries.entry_date", to);

  if (from) q = q.gte("journal_entries.entry_date", from);
  if (branchId) q = q.eq("journal_entries.branch_id", branchId);

  const { data, error } = await q;
  if (error) return { rows: null as LineRow[] | null, error: error.message };
  return { rows: (data ?? []) as unknown as LineRow[], error: null as string | null };
}

async function accounts(): Promise<{ list: GlAccount[]; error: string | null }> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("gl_accounts")
    .select("code, name, account_type, normal_side, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return { list: [], error: error.message };
  return { list: (data ?? []) as GlAccount[], error: null };
}

export async function trialBalance(
  from: string,
  to: string,
  branchId?: string | null
): Promise<TrialBalance> {
  const [{ list, error: accErr }, { rows, error: lineErr }] = await Promise.all([
    accounts(),
    lines(from, to, branchId),
  ]);

  // Jawab na mile to khali fehrist NAHI lautayi jati. Khali fehrist
  // "sab khaate sifar hain" kehti hai, aur wo jhoot hai.
  if (accErr || lineErr || !rows) {
    return { rows: [], totalDebit: 0, totalCredit: 0, farq: 0, error: accErr ?? lineErr ?? "maloom nahi" };
  }

  const dr = new Map<string, number>();
  const cr = new Map<string, number>();
  for (const l of rows) {
    dr.set(l.account_code, (dr.get(l.account_code) ?? 0) + Number(l.debit ?? 0));
    cr.set(l.account_code, (cr.get(l.account_code) ?? 0) + Number(l.credit ?? 0));
  }

  const out: TrialRow[] = list
    .map((a) => {
      const debit = dr.get(a.code) ?? 0;
      const credit = cr.get(a.code) ?? 0;
      return {
        ...a,
        debit,
        credit,
        balance: a.normal_side === "debit" ? debit - credit : credit - debit,
      };
    })
    // Jis khate par saal bhar kuch hua hi nahi, usay dikhana shor hai.
    .filter((r) => r.debit !== 0 || r.credit !== 0);

  const totalDebit = out.reduce((s, r) => s + r.debit, 0);
  const totalCredit = out.reduce((s, r) => s + r.credit, 0);

  return {
    rows: out,
    totalDebit,
    totalCredit,
    farq: Math.round((totalDebit - totalCredit) * 100) / 100,
  };
}

export interface PnlSection {
  rows: TrialRow[];
  total: number;
}
export interface Pnl {
  income: PnlSection;
  cogs: PnlSection;
  expense: PnlSection;
  grossProfit: number;
  netProfit: number;
  error?: string;
}

/** Lagat ke khaate: beche hue maal / doodh / grain ki kharid. */
const COGS_CODES = new Set(["5000", "5010", "5020"]);

export async function profitAndLoss(from: string, to: string, branchId?: string | null): Promise<Pnl> {
  const tb = await trialBalance(from, to, branchId);
  const khali: PnlSection = { rows: [], total: 0 };
  if (tb.error) return { income: khali, cogs: khali, expense: khali, grossProfit: 0, netProfit: 0, error: tb.error };

  const pick = (fn: (r: TrialRow) => boolean): PnlSection => {
    const rows = tb.rows.filter(fn);
    return { rows, total: rows.reduce((s, r) => s + r.balance, 0) };
  };

  const income = pick((r) => r.account_type === "income");
  // Lagat ko baqi kharchon se alag rakha jata hai. Milaa dene se ye
  // sawal ka jawab nahi milta ke "maal par kitna bacha" -- aur dukan par
  // yehi asal sawal hai.
  const cogs = pick((r) => r.account_type === "expense" && COGS_CODES.has(r.code));
  const expense = pick((r) => r.account_type === "expense" && !COGS_CODES.has(r.code));

  const grossProfit = income.total - cogs.total;
  return { income, cogs, expense, grossProfit, netProfit: grossProfit - expense.total };
}

export interface BsSection {
  rows: TrialRow[];
  total: number;
}
export interface BalanceSheet {
  assets: BsSection;
  liabilities: BsSection;
  equity: BsSection;
  /** Is saal ka nafa -- jab tak khate band na hon, ye alag dikhta hai. */
  yearProfit: number;
  totalLeft: number;
  totalRight: number;
  farq: number;
  error?: string;
}

export async function balanceSheet(
  asOf: string,
  yearStart: string,
  branchId?: string | null
): Promise<BalanceSheet> {
  // Asason aur zimmon ka baqi SHURU se ab tak ka hota hai -- is liye
  // yahan tareekh ki koi shuruaat nahi.
  const [tb, pnl] = await Promise.all([
    trialBalance("1900-01-01", asOf, branchId),
    profitAndLoss(yearStart, asOf, branchId),
  ]);
  const khali: BsSection = { rows: [], total: 0 };
  if (tb.error || pnl.error) {
    return {
      assets: khali,
      liabilities: khali,
      equity: khali,
      yearProfit: 0,
      totalLeft: 0,
      totalRight: 0,
      farq: 0,
      error: tb.error ?? pnl.error,
    };
  }

  const pick = (type: AccountType): BsSection => {
    const rows = tb.rows.filter((r) => r.account_type === type);
    return { rows, total: rows.reduce((s, r) => s + r.balance, 0) };
  };

  const assets = pick("asset");
  const liabilities = pick("liability");
  const equity = pick("equity");
  const yearProfit = pnl.netProfit;

  const totalLeft = assets.total;
  const totalRight = liabilities.total + equity.total + yearProfit;

  return {
    assets,
    liabilities,
    equity,
    yearProfit,
    totalLeft,
    totalRight,
    farq: Math.round((totalLeft - totalRight) * 100) / 100,
  };
}

export interface JournalLineView {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  memo: string | null;
}
export interface JournalEntryView {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  source_module: string;
  is_reversal: boolean;
  is_backdated: boolean;
  lines: JournalLineView[];
}

/** Poora journal -- har entry, har qatar. */
export async function generalJournal(
  from: string,
  to: string,
  limit = 100,
  branchId?: string | null
): Promise<{ entries: JournalEntryView[]; error?: string }> {
  const service = createServiceClient();

  let q = service
    .from("journal_entries")
    .select("id, entry_number, entry_date, description, source_module, is_reversal, is_backdated")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false })
    .order("entry_number", { ascending: false })
    .limit(limit);
  if (branchId) q = q.eq("branch_id", branchId);

  const { data: entries, error } = await q;
  if (error) return { entries: [], error: error.message };
  if (!entries || entries.length === 0) return { entries: [] };

  // Qatarein aur khaton ke naam alag sawalon se -- nested embed nakaam
  // ho to wo KHALI lauta deta hai, aur khali qatarein wali entry parh kar
  // banda samajhta hai ke entry mein kuch tha hi nahi.
  const ids = entries.map((e) => e.id);
  const [{ data: lineRows }, { list }] = await Promise.all([
    service
      .from("journal_lines")
      .select("entry_id, account_code, debit, credit, memo, line_order")
      .in("entry_id", ids)
      .order("line_order"),
    accounts(),
  ]);
  const nameByCode = new Map(list.map((a) => [a.code, a.name]));

  const byEntry = new Map<string, JournalLineView[]>();
  for (const l of lineRows ?? []) {
    const arr = byEntry.get(l.entry_id) ?? [];
    arr.push({
      account_code: l.account_code,
      account_name: nameByCode.get(l.account_code) ?? l.account_code,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
      memo: l.memo,
    });
    byEntry.set(l.entry_id, arr);
  }

  return {
    entries: entries.map((e) => ({
      id: e.id,
      entry_number: e.entry_number,
      entry_date: e.entry_date,
      description: e.description,
      source_module: e.source_module,
      is_reversal: !!e.is_reversal,
      is_backdated: !!e.is_backdated,
      lines: byEntry.get(e.id) ?? [],
    })),
  };
}
