import { createServiceClient } from "@/lib/supabase/service";

/**
 * "Paisa kahan hai?"
 *
 * Ek hi sawal ka jawab, aur wo bhi ek hi jagah se: har khate ka balance
 * seedha journal ki qataron se ginta hai. Kisi alag "balance" wale khane
 * se nahi.
 *
 * Ye farq bara hai. Alag rakha hua balance ek din asal qataron se hat
 * jata hai -- koi entry seedhi SQL se lag jati hai, ya koi update reh
 * jata hai -- aur phir do adad hote hain jin mein se koi nahi jaanta
 * kaun sa sach hai. Yahan sirf ek sach hai: qataren.
 */

export interface AccountBalance {
  code: string;
  name: string;
  type: string;
  normalSide: string;
  debit: number;
  credit: number;
  /** Us khate ki apni tarah ka balance (asset/expense = debit − credit). */
  balance: number;
}

export interface TrialBalance {
  rows: AccountBalance[];
  totalDebit: number;
  totalCredit: number;
  /** Sifar hona chahiye. Na ho to kuch bunyadi tor par ghalat hai. */
  difference: number;
  balanced: boolean;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export interface TrialOptions {
  from?: string;
  to?: string;
  branchId?: string | null;
}

/**
 * Trial Balance -- poore system ki sehat ka ek hi adad.
 *
 * Har entry par debit = credit ka taala laga hua hai, is liye ye farq
 * sifar hi hona chahiye. Agar kabhi sifar na ho, to matlab ye nahi ke
 * kisi ne paisa chura liya -- matlab ye hai ke system mein kuch
 * bunyadi tor par toota hua hai, aur us waqt baqi har adad par shak
 * karna chahiye.
 */
export async function trialBalance(options: TrialOptions = {}): Promise<TrialBalance> {
  const service = createServiceClient();

  let query = service
    .from("journal_lines")
    .select("account_code, debit, credit, journal_entries!inner(entry_date, branch_id)");

  if (options.from) query = query.gte("journal_entries.entry_date", options.from);
  if (options.to) query = query.lte("journal_entries.entry_date", options.to);
  if (options.branchId) query = query.eq("journal_entries.branch_id", options.branchId);

  const [{ data: lines }, { data: accounts }] = await Promise.all([
    query,
    service.from("gl_accounts").select("code, name, account_type, normal_side, sort_order").order("sort_order"),
  ]);

  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lines ?? []) {
    const current = totals.get(line.account_code) ?? { debit: 0, credit: 0 };
    current.debit += Number(line.debit);
    current.credit += Number(line.credit);
    totals.set(line.account_code, current);
  }

  const rows: AccountBalance[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const account of accounts ?? []) {
    const t = totals.get(account.code);
    if (!t || (t.debit === 0 && t.credit === 0)) continue;

    const debit = round2(t.debit);
    const credit = round2(t.credit);
    totalDebit += debit;
    totalCredit += credit;

    rows.push({
      code: account.code,
      name: account.name,
      type: account.account_type,
      normalSide: account.normal_side,
      debit,
      credit,
      balance: round2(account.normal_side === "debit" ? debit - credit : credit - debit),
    });
  }

  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  const difference = round2(totalDebit - totalCredit);

  return { rows, totalDebit, totalCredit, difference, balanced: difference === 0 };
}

export interface MoneyTrail {
  cash: number;
  bank: number;
  inTransit: number;
  cashWithPerson: number;
  receivableCustomers: number;
  receivableFarmers: number;
  receivableBranches: number;
  advanceSuppliers: number;
  advanceStaff: number;
  advanceFarmers: number;
  stock: number;
  payableSuppliers: number;
  payableFarmers: number;
  payableStaff: number;
  walletLiability: number;
  suspense: number;
  /** Sab kuch mila kar -- kul maal-o-asbaab. */
  totalAssets: number;
  totalLiabilities: number;
  net: number;
  balanced: boolean;
  difference: number;
}

const GROUPS = {
  cash: ["1000"],
  bank: ["1010"],
  inTransit: ["1020"],
  cashWithPerson: ["1030"],
  receivableCustomers: ["1100"],
  receivableFarmers: ["1150"],
  receivableBranches: ["1110"],
  advanceSuppliers: ["1120"],
  advanceStaff: ["1130"],
  advanceFarmers: ["1140"],
  stock: ["1200", "1210", "1220"],
  payableSuppliers: ["2000"],
  payableFarmers: ["2010"],
  payableStaff: ["2020"],
  walletLiability: ["2040"],
  suspense: ["9999"],
} as const;

/**
 * Paisa is waqt kahan kahan para hua hai.
 *
 * Suspense ("abhi wajah maloom nahi") jaan boojh kar is fehrist mein
 * hai. Jo raqam samajh na aaye wo kahin chhupayi nahi jati -- us ka apna
 * khana hai, aur us khane ka sifar se barha hona khud ek sawal hai.
 */
export async function moneyTrail(branchId: string | null = null): Promise<MoneyTrail> {
  const tb = await trialBalance({ branchId });
  const byCode = new Map(tb.rows.map((r) => [r.code, r]));

  const sumOf = (codes: readonly string[]) =>
    round2(codes.reduce((total, code) => total + (byCode.get(code)?.balance ?? 0), 0));

  const result = Object.fromEntries(
    Object.entries(GROUPS).map(([key, codes]) => [key, sumOf(codes)])
  ) as Record<keyof typeof GROUPS, number>;

  const totalAssets = round2(
    tb.rows.filter((r) => r.type === "asset").reduce((t, r) => t + r.balance, 0)
  );
  const totalLiabilities = round2(
    tb.rows.filter((r) => r.type === "liability").reduce((t, r) => t + r.balance, 0)
  );

  return {
    ...result,
    totalAssets,
    totalLiabilities,
    net: round2(totalAssets - totalLiabilities),
    balanced: tb.balanced,
    difference: tb.difference,
  };
}

export interface LedgerLine {
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceModule: string;
  debit: number;
  credit: number;
  memo: string | null;
  isReversal: boolean;
}

/**
 * Kisi ek khate ka poora silsila -- har qatar, tarteeb ke sath.
 *
 * Yahi wo jagah hai jahan "Rs 1 kahan gaya" ka jawab milta hai.
 */
export async function accountLedger(
  accountCode: string,
  options: TrialOptions = {},
  limit = 200
): Promise<LedgerLine[]> {
  const service = createServiceClient();

  let query = service
    .from("journal_lines")
    .select("debit, credit, memo, journal_entries!inner(entry_number, entry_date, description, source_module, branch_id, is_reversal)")
    .eq("account_code", accountCode)
    .limit(limit);

  if (options.from) query = query.gte("journal_entries.entry_date", options.from);
  if (options.to) query = query.lte("journal_entries.entry_date", options.to);
  if (options.branchId) query = query.eq("journal_entries.branch_id", options.branchId);

  const { data } = await query;

  return (data ?? [])
    .map((row) => {
      const entry = Array.isArray(row.journal_entries) ? row.journal_entries[0] : row.journal_entries;
      return {
        entryNumber: entry?.entry_number ?? "—",
        entryDate: entry?.entry_date ?? "",
        description: entry?.description ?? "",
        sourceModule: entry?.source_module ?? "",
        debit: Number(row.debit),
        credit: Number(row.credit),
        memo: row.memo,
        isReversal: entry?.is_reversal ?? false,
      };
    })
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.entryNumber.localeCompare(a.entryNumber));
}

/**
 * Jo abhi ledger tak nahi pahuncha.
 *
 * Sab se ahem adad isi safhe par yahi hai, aur wajah ye hai:
 *
 * Trial Balance HAMESHA barabar rehta hai -- har entry par debit =
 * credit ka taala laga hua hai. Is liye "Balanced" dekh kar ye nahi
 * kaha ja sakta ke hisaab poora hai. Wo sirf ye batata hai ke JO likha
 * gaya wo theek likha gaya; ye nahi ke sab kuch likha bhi gaya.
 *
 * Paisa is farq mein se nikalta hai: kaam hua, purani table mein darj
 * bhi hua, magar double-entry tak nahi pahuncha. Is liye wo raqam yahan
 * ginti hai -- taake "sab theek hai" ke peeche na chhup sake.
 */
export interface UnpostedRow {
  sourceTable: string;
  rowId: string;
  amount: number;
  createdAt: string;
  kind: string;
  detail: string;
}

export interface Coverage {
  sourceTable: string;
  label: string;
  pending: number;
  pendingAmount: number;
}

const TABLE_LABELS: Record<string, string> = {
  finance_transactions: "Cash Book (finance)",
  farmer_credit_ledger: "Kisan ka khata",
  branch_credit_transactions: "Branch ka khata",
  staff_credit_ledger: "Staff ka khata",
  customer_ledger: "Customer ka khata",
  wallet_transactions: "Wallet",
  company_expense_requests: "Company ke kharche",
};

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

export async function ledgerCoverage(): Promise<{
  rows: Coverage[];
  totalPending: number;
  totalAmount: number;
  complete: boolean;
}> {
  const service = createServiceClient();
  const { data } = await service.from("v_ledger_coverage").select("source_table, pending, pending_amount");

  const rows: Coverage[] = (data ?? []).map((r) => ({
    sourceTable: r.source_table ?? "",
    label: tableLabel(r.source_table ?? ""),
    pending: Number(r.pending ?? 0),
    pendingAmount: Number(r.pending_amount ?? 0),
  }));

  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const totalAmount = round2(rows.reduce((s, r) => s + r.pendingAmount, 0));

  return { rows, totalPending, totalAmount, complete: totalPending === 0 };
}

/** Wo rows khud, taake dekha ja sake ke kaunsi raqam reh gayi. */
export async function unpostedRows(limit = 50): Promise<UnpostedRow[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("v_ledger_unposted")
    .select("source_table, row_id, amount, created_at, kind, detail")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    sourceTable: r.source_table ?? "",
    rowId: r.row_id ?? "",
    amount: Number(r.amount ?? 0),
    createdAt: r.created_at ?? "",
    kind: r.kind ?? "",
    detail: r.detail ?? "",
  }));
}
