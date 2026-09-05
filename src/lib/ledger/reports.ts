import { createServiceClient } from "@/lib/supabase/service";
import { trialBalance, type TrialRow } from "@/lib/ledger/statements";

/**
 * Maali reports -- malik ke naqshe ka paanchwan group.
 *
 * Gosharon (statements.ts) ki tarah, YAHAN BHI KOI NAYA HISAAB NAHI
 * BANTA. Chaaron reports usi `journal_lines` par khaRi hain jahan POS,
 * kharid, doodh, machinery aur asaasay pehle se likhte hain.
 *
 * Ye baat dobara likhi ja rahi hai kyunki report banate waqt sab se
 * bara laalach yehi hota hai: "is report ke liye adad zara alag chahiye,
 * yahin gin lete hain". Us ke baad do jagah do adad hote hain, dono
 * theek lagte hain, aur koi nahi bata sakta ke sahi kaunsa hai.
 */

/** Cash aur bank ke khate -- inhi mein asal paisa hilta hai. */
const CASH_CODES = new Set(["1000", "1010", "1020", "1030"]);

/** Mustaqil asaason ke khate -- ye khareed/farokht "investing" hai. */
function isFixedAsset(code: string): boolean {
  return code >= "1300" && code <= "1399";
}

export interface ReportError {
  error: string;
}

interface RawLine {
  entry_id: string;
  account_code: string;
  debit: number | null;
  credit: number | null;
  memo: string | null;
  party_type: string | null;
  party_id: string | null;
  journal_entries: { entry_date: string; branch_id: string | null; description: string; entry_number: string };
}

async function rawLines(
  from: string | null,
  to: string,
  branchId?: string | null
): Promise<{ rows: RawLine[]; error: null } | { rows: null; error: string }> {
  const service = createServiceClient();
  let q = service
    .from("journal_lines")
    .select(
      "entry_id, account_code, debit, credit, memo, party_type, party_id, journal_entries!inner(entry_date, branch_id, description, entry_number)"
    )
    .lte("journal_entries.entry_date", to);
  if (from) q = q.gte("journal_entries.entry_date", from);
  if (branchId) q = q.eq("journal_entries.branch_id", branchId);

  const { data, error } = await q;
  // Khali fehrist NAHI lautayi jati -- wo "kuch hua hi nahi" kehti hai.
  if (error) return { rows: null, error: error.message };
  return { rows: (data ?? []) as unknown as RawLine[], error: null };
}

async function accountNames(): Promise<Map<string, { name: string; type: string }>> {
  const service = createServiceClient();
  const { data } = await service.from("gl_accounts").select("code, name, account_type");
  return new Map((data ?? []).map((a) => [a.code as string, { name: a.name as string, type: a.account_type as string }]));
}

// =====================================================================
// 1. Cash Flow -- paisa kahan se aaya, kahan gaya
// =====================================================================
/**
 * SEEDHA (direct) tareeqa: sirf wo entries dekhi jati hain jin mein cash
 * ya bank ka khata shamil hai, aur us entry ki DOOSRI taraf batati hai
 * ke paisa kis wajah se hila.
 *
 * Ye "nafe se shuru kar ke ulta hisaab" (indirect) wale tareeqe se is
 * karobar ke liye behtar hai: yahan sawal "nafa kitna tha" nahi, sawal
 * "paisa kahan gaya" hota hai -- aur us ka jawab seedha nazar aana
 * chahiye, teen tabdeeliyon ke baad nahi.
 */
export interface CashFlowRow {
  code: string;
  name: string;
  /** Musbat = cash aaya, manfi = cash gaya. */
  amount: number;
}
export interface CashFlow {
  opening: number;
  closing: number;
  operating: CashFlowRow[];
  investing: CashFlowRow[];
  financing: CashFlowRow[];
  operatingTotal: number;
  investingTotal: number;
  financingTotal: number;
  netChange: number;
  error?: string;
}

export async function cashFlow(from: string, to: string, branchId?: string | null): Promise<CashFlow> {
  const khali: CashFlow = {
    opening: 0,
    closing: 0,
    operating: [],
    investing: [],
    financing: [],
    operatingTotal: 0,
    investingTotal: 0,
    financingTotal: 0,
    netChange: 0,
  };

  const [{ rows, error }, names, tbOpen, tbClose] = await Promise.all([
    rawLines(from, to, branchId),
    accountNames(),
    trialBalance("1900-01-01", pehlaDinSePehle(from), branchId),
    trialBalance("1900-01-01", to, branchId),
  ]);
  if (error || !rows) return { ...khali, error: error ?? "maloom nahi" };
  if (tbOpen.error || tbClose.error) return { ...khali, error: tbOpen.error ?? tbClose.error };

  const cashBaqi = (t: { rows: TrialRow[] }) =>
    t.rows.filter((r) => CASH_CODES.has(r.code)).reduce((s, r) => s + r.balance, 0);

  const opening = cashBaqi(tbOpen);
  const closing = cashBaqi(tbClose);

  // Entry ke hisaab se: ek taraf cash, doosri taraf wajah.
  const byEntry = new Map<string, RawLine[]>();
  for (const l of rows) {
    const list = byEntry.get(l.entry_id) ?? [];
    list.push(l);
    byEntry.set(l.entry_id, list);
  }

  const wajah = new Map<string, number>();
  for (const lines of byEntry.values()) {
    const cashLines = lines.filter((l) => CASH_CODES.has(l.account_code));
    if (cashLines.length === 0) continue;

    const cashDelta = cashLines.reduce((s, l) => s + Number(l.debit ?? 0) - Number(l.credit ?? 0), 0);
    if (Math.abs(cashDelta) < 0.005) continue;

    const others = lines.filter((l) => !CASH_CODES.has(l.account_code));
    const kul = others.reduce((s, l) => s + Math.abs(Number(l.debit ?? 0) - Number(l.credit ?? 0)), 0);

    if (others.length === 0 || kul < 0.005) {
      // Cash se cash (misal: bank se cash nikala). Ye paise ki aamad ya
      // rawangi nahi -- sirf jagah ki tabdeeli hai, is liye nazar andaz.
      continue;
    }

    for (const o of others) {
      const hissa = Math.abs(Number(o.debit ?? 0) - Number(o.credit ?? 0)) / kul;
      wajah.set(o.account_code, (wajah.get(o.account_code) ?? 0) + cashDelta * hissa);
    }
  }

  const operating: CashFlowRow[] = [];
  const investing: CashFlowRow[] = [];
  const financing: CashFlowRow[] = [];

  for (const [code, amount] of wajah) {
    if (Math.abs(amount) < 0.5) continue;
    const meta = names.get(code);
    const row: CashFlowRow = { code, name: meta?.name ?? code, amount: Math.round(amount * 100) / 100 };
    if (isFixedAsset(code)) investing.push(row);
    else if (meta?.type === "equity") financing.push(row);
    else operating.push(row);
  }

  const jama = (rs: CashFlowRow[]) => Math.round(rs.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const sort = (rs: CashFlowRow[]) => rs.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  return {
    opening,
    closing,
    operating: sort(operating),
    investing: sort(investing),
    financing: sort(financing),
    operatingTotal: jama(operating),
    investingTotal: jama(investing),
    financingTotal: jama(financing),
    netChange: Math.round((closing - opening) * 100) / 100,
  };
}

function pehlaDinSePehle(tareekh: string): string {
  const d = new Date(`${tareekh}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// =====================================================================
// 2. Chalta sarmaya (Working Capital)
// =====================================================================
export interface WorkingCapital {
  currentAssets: TrialRow[];
  currentLiabilities: TrialRow[];
  assetsTotal: number;
  liabilitiesTotal: number;
  workingCapital: number;
  /** Baqi ke muqable mein -- 1 se kam ho to adaigi ka dabao hai. */
  ratio: number | null;
  error?: string;
}

export async function workingCapital(asOf: string, branchId?: string | null): Promise<WorkingCapital> {
  const tb = await trialBalance("1900-01-01", asOf, branchId);
  const khali: WorkingCapital = {
    currentAssets: [],
    currentLiabilities: [],
    assetsTotal: 0,
    liabilitiesTotal: 0,
    workingCapital: 0,
    ratio: null,
  };
  if (tb.error) return { ...khali, error: tb.error };

  // Chalte asaasay = wo asaasay jo saal bhar mein paise mein badal jate
  // hain: cash, bank, lena, stock. Mustaqil asaasay (13xx) is mein NAHI
  // aate -- tractor bech kar tankhwah nahi di jati.
  const currentAssets = tb.rows.filter(
    (r) => r.account_type === "asset" && !isFixedAsset(r.code) && r.code !== "9999"
  );
  const currentLiabilities = tb.rows.filter((r) => r.account_type === "liability");

  const assetsTotal = Math.round(currentAssets.reduce((s, r) => s + r.balance, 0) * 100) / 100;
  const liabilitiesTotal = Math.round(currentLiabilities.reduce((s, r) => s + r.balance, 0) * 100) / 100;

  return {
    currentAssets,
    currentLiabilities,
    assetsTotal,
    liabilitiesTotal,
    workingCapital: Math.round((assetsTotal - liabilitiesTotal) * 100) / 100,
    // Zimme sifar hon to nisbat ka koi matlab nahi -- wahan NULL jata
    // hai, koi bana hua adad nahi.
    ratio: liabilitiesTotal === 0 ? null : Math.round((assetsTotal / liabilitiesTotal) * 100) / 100,
  };
}

// =====================================================================
// 3. Khaton ka opening / harkat / closing
// =====================================================================
export interface ClosingRow {
  code: string;
  name: string;
  type: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}
export interface ClosingBalances {
  rows: ClosingRow[];
  error?: string;
}

export async function closingBalances(from: string, to: string, branchId?: string | null): Promise<ClosingBalances> {
  const [tbOpen, tbMove] = await Promise.all([
    trialBalance("1900-01-01", pehlaDinSePehle(from), branchId),
    trialBalance(from, to, branchId),
  ]);
  if (tbOpen.error || tbMove.error) return { rows: [], error: tbOpen.error ?? tbMove.error };

  const openMap = new Map(tbOpen.rows.map((r) => [r.code, r]));
  const codes = new Set([...tbOpen.rows.map((r) => r.code), ...tbMove.rows.map((r) => r.code)]);
  const moveMap = new Map(tbMove.rows.map((r) => [r.code, r]));

  const rows: ClosingRow[] = [];
  for (const code of codes) {
    const o = openMap.get(code);
    const m = moveMap.get(code);
    const meta = o ?? m;
    if (!meta) continue;
    const opening = o?.balance ?? 0;
    const debit = m?.debit ?? 0;
    const credit = m?.credit ?? 0;
    const harkat = meta.normal_side === "debit" ? debit - credit : credit - debit;
    rows.push({
      code,
      name: meta.name,
      type: meta.account_type,
      opening,
      debit,
      credit,
      closing: Math.round((opening + harkat) * 100) / 100,
    });
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));
  return { rows };
}

// =====================================================================
// 4. Adaigi aur wasooli ka khulasa
// =====================================================================
export interface PayReceiveRow {
  code: string;
  name: string;
  received: number;
  paid: number;
}
export interface PayReceiveSummary {
  rows: PayReceiveRow[];
  totalReceived: number;
  totalPaid: number;
  error?: string;
}

/** Har cash/bank khate mein kitna aaya aur kitna gaya. */
export async function payReceiveSummary(
  from: string,
  to: string,
  branchId?: string | null
): Promise<PayReceiveSummary> {
  const [{ rows, error }, names] = await Promise.all([rawLines(from, to, branchId), accountNames()]);
  if (error || !rows) return { rows: [], totalReceived: 0, totalPaid: 0, error: error ?? "maloom nahi" };

  const aaya = new Map<string, number>();
  const gaya = new Map<string, number>();
  for (const l of rows) {
    if (!CASH_CODES.has(l.account_code)) continue;
    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    if (d > 0) aaya.set(l.account_code, (aaya.get(l.account_code) ?? 0) + d);
    if (c > 0) gaya.set(l.account_code, (gaya.get(l.account_code) ?? 0) + c);
  }

  const codes = new Set([...aaya.keys(), ...gaya.keys()]);
  const out: PayReceiveRow[] = Array.from(codes).map((code) => ({
    code,
    name: names.get(code)?.name ?? code,
    received: Math.round((aaya.get(code) ?? 0) * 100) / 100,
    paid: Math.round((gaya.get(code) ?? 0) * 100) / 100,
  }));
  out.sort((a, b) => a.code.localeCompare(b.code));

  return {
    rows: out,
    totalReceived: Math.round(out.reduce((s, r) => s + r.received, 0) * 100) / 100,
    totalPaid: Math.round(out.reduce((s, r) => s + r.paid, 0) * 100) / 100,
  };
}

// =====================================================================
// 5. Kis se lena, kis ko dena -- bande ke hisaab se
// =====================================================================
export interface PartyRow {
  partyType: string;
  partyId: string;
  name: string | null;
  receivable: number;
  payable: number;
  net: number;
}
export interface PartyBalances {
  rows: PartyRow[];
  totalReceivable: number;
  totalPayable: number;
  /** Jin qataron par bande ka nishaan hai hi nahi. */
  bagherNishaan: number;
  error?: string;
}

const RECEIVABLE = new Set(["1100", "1120", "1130", "1140", "1150", "1160", "1170"]);
const PAYABLE = new Set(["2000", "2010", "2020", "2025", "2030"]);

/**
 * Har bande ka lena-dena.
 *
 * Qataren `journal_lines` ke party_type/party_id se aati hain -- yani
 * wohi jagah jahan har module apna waqia likhta hai. Naam alag sawal se
 * aate hain (nested embed nahi -- wo khali laut sakta hai).
 *
 * Jin qataron par bande ka nishaan nahi laga, unhen chup chaap chhoRa
 * nahi jata: un ki ginti alag se lauti jati hai, taake ye maloom rahe
 * ke kitna hissa is fehrist se BAHAR hai.
 */
export async function partyBalances(asOf: string, branchId?: string | null): Promise<PartyBalances> {
  const { rows, error } = await rawLines(null, asOf, branchId);
  if (error || !rows) return { rows: [], totalReceivable: 0, totalPayable: 0, bagherNishaan: 0, error: error ?? "maloom nahi" };

  const map = new Map<string, PartyRow>();
  let bagherNishaan = 0;

  for (const l of rows) {
    const isRec = RECEIVABLE.has(l.account_code);
    const isPay = PAYABLE.has(l.account_code);
    if (!isRec && !isPay) continue;

    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    if (!l.party_type || !l.party_id) {
      bagherNishaan += Math.abs(d - c);
      continue;
    }

    const key = `${l.party_type}:${l.party_id}`;
    const row = map.get(key) ?? {
      partyType: l.party_type,
      partyId: l.party_id,
      name: null,
      receivable: 0,
      payable: 0,
      net: 0,
    };
    if (isRec) row.receivable += d - c;
    else row.payable += c - d;
    map.set(key, row);
  }

  const out = Array.from(map.values())
    .map((r) => ({
      ...r,
      receivable: Math.round(r.receivable * 100) / 100,
      payable: Math.round(r.payable * 100) / 100,
      net: Math.round((r.receivable - r.payable) * 100) / 100,
    }))
    .filter((r) => Math.abs(r.receivable) > 0.5 || Math.abs(r.payable) > 0.5);

  await naamLagayein(out);

  out.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  return {
    rows: out,
    totalReceivable: Math.round(out.reduce((s, r) => s + r.receivable, 0) * 100) / 100,
    totalPayable: Math.round(out.reduce((s, r) => s + r.payable, 0) * 100) / 100,
    bagherNishaan: Math.round(bagherNishaan * 100) / 100,
  };
}

const PARTY_TABLE: Record<string, { table: string; column: string }> = {
  farmer: { table: "farmers", column: "full_name" },
  supplier: { table: "suppliers", column: "name" },
  customer: { table: "customers", column: "name" },
  dealer: { table: "dealers", column: "business_name" },
  staff: { table: "profiles", column: "full_name" },
  branch: { table: "branches", column: "name" },
};

async function naamLagayein(rows: PartyRow[]): Promise<void> {
  const service = createServiceClient();
  const byType = new Map<string, string[]>();
  for (const r of rows) {
    const list = byType.get(r.partyType) ?? [];
    list.push(r.partyId);
    byType.set(r.partyType, list);
  }

  for (const [type, ids] of byType) {
    const meta = PARTY_TABLE[type];
    if (!meta) continue;
    const { data } = await service
      .from(meta.table as never)
      .select(`id, ${meta.column}`)
      .in("id", ids);
    const naam = new Map((data ?? []).map((d: any) => [d.id as string, d[meta.column] as string]));
    for (const r of rows) {
      // Naam na mile to NULL rehta hai -- "—" dikhta hai, koi bana hua
      // naam nahi.
      if (r.partyType === type) r.name = naam.get(r.partyId) ?? null;
    }
  }
}

// =====================================================================
// 6. Shaakh shaakh ka nafa nuqsan
// =====================================================================
export interface BranchPnlRow {
  branchId: string | null;
  branchName: string;
  income: number;
  cogs: number;
  expense: number;
  profit: number;
}
export interface BranchPnl {
  rows: BranchPnlRow[];
  error?: string;
}

const COGS_CODES = new Set(["5000", "5010", "5020"]);

export async function branchPnl(from: string, to: string): Promise<BranchPnl> {
  const [{ rows, error }, names] = await Promise.all([rawLines(from, to, null), accountNames()]);
  if (error || !rows) return { rows: [], error: error ?? "maloom nahi" };

  const service = createServiceClient();
  const { data: branches } = await service.from("branches").select("id, name");
  const branchName = new Map((branches ?? []).map((b) => [b.id as string, b.name as string]));

  const map = new Map<string, BranchPnlRow>();
  for (const l of rows) {
    const meta = names.get(l.account_code);
    if (!meta) continue;
    if (meta.type !== "income" && meta.type !== "expense") continue;

    const bid = l.journal_entries.branch_id;
    const key = bid ?? "__koi_nahi__";
    const row =
      map.get(key) ??
      ({
        branchId: bid,
        // Jis entry par shaakh likhi hi nahi, us ka apna khana -- usay
        // kisi shaakh mein daal dena us shaakh ka nafa jhoota kar dega.
        branchName: bid ? (branchName.get(bid) ?? "—") : "(shaakh nahi likhi)",
        income: 0,
        cogs: 0,
        expense: 0,
        profit: 0,
      } as BranchPnlRow);

    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    if (meta.type === "income") row.income += c - d;
    else if (COGS_CODES.has(l.account_code)) row.cogs += d - c;
    else row.expense += d - c;

    map.set(key, row);
  }

  const out = Array.from(map.values()).map((r) => ({
    ...r,
    income: Math.round(r.income * 100) / 100,
    cogs: Math.round(r.cogs * 100) / 100,
    expense: Math.round(r.expense * 100) / 100,
    profit: Math.round((r.income - r.cogs - r.expense) * 100) / 100,
  }));
  out.sort((a, b) => b.profit - a.profit);
  return { rows: out };
}


// =====================================================================
// 7. Ek khate ka apna ledger -- qatar dar qatar, chalta hua baqi
// =====================================================================
/**
 * Malik ka kehna (5 September): "mery her ledger mein jahan jahan use ho
 * raha hai debit credit OR BALANCE aana chahiye ... sab details ke sath
 * aaye, hamein kal ko asani ho track karne ki."
 *
 * Yehi wo safha hai jo goshare se ASAL kaam ka banata hai. Trial Balance
 * batata hai ke khate mein kitna para hai; ye batata hai ke wo raqam
 * BANI KAISE -- kis din, kis entry se, aur us ke baad baqi kya ho gaya.
 *
 * Chalta hua baqi (running balance) khate ke apne RUKH par ginta hai:
 * debit rukh wale khate mein debit barhata hai, credit rukh wale mein
 * credit. Ulta ginne se har asaase ka baqi manfi nazar aane lagta hai
 * aur banda har qatar par ruk kar sochta hai.
 *
 * Shuru ka baqi (opening) alag se aata hai -- us ke baghair pehli qatar
 * ka baqi jhoota hota hai, kyunki us se pehle ki poori tareekh ginti hi
 * nahi.
 */
export interface LedgerLine {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  memo: string | null;
  partyType: string | null;
  debit: number;
  credit: number;
  /** Is qatar ke BAAD ka baqi -- khate ke apne rukh par. */
  balance: number;
}
export interface AccountLedger {
  code: string;
  name: string;
  accountType: string;
  normalSide: "debit" | "credit";
  opening: number;
  totalDebit: number;
  totalCredit: number;
  closing: number;
  lines: LedgerLine[];
  error?: string;
}

export async function accountLedger(
  code: string,
  from: string,
  to: string,
  branchId?: string | null
): Promise<AccountLedger> {
  const service = createServiceClient();
  const khali: AccountLedger = {
    code,
    name: code,
    accountType: "",
    normalSide: "debit",
    opening: 0,
    totalDebit: 0,
    totalCredit: 0,
    closing: 0,
    lines: [],
  };

  const { data: acc, error: accErr } = await service
    .from("gl_accounts")
    .select("code, name, account_type, normal_side")
    .eq("code", code)
    .maybeSingle();
  if (accErr) return { ...khali, error: accErr.message };
  if (!acc) return { ...khali, error: `Khata ${code} maujood nahi.` };

  const side = acc.normal_side as "debit" | "credit";

  // Shuru ka baqi: is tareekh se PEHLE ka sab kuch.
  const pehle = pehlaDinSePehle(from);
  const [{ rows: pichhli, error: e1 }, { rows: abKi, error: e2 }] = await Promise.all([
    rawLines(null, pehle, branchId),
    rawLines(from, to, branchId),
  ]);
  if (e1 || e2 || !pichhli || !abKi) {
    return { ...khali, name: acc.name as string, error: e1 ?? e2 ?? "maloom nahi" };
  }

  const jama = (rows: RawLine[]) => {
    let d = 0;
    let c = 0;
    for (const l of rows) {
      if (l.account_code !== code) continue;
      d += Number(l.debit ?? 0);
      c += Number(l.credit ?? 0);
    }
    return { d, c };
  };

  const purana = jama(pichhli);
  const opening = Math.round((side === "debit" ? purana.d - purana.c : purana.c - purana.d) * 100) / 100;

  const meri = abKi
    .filter((l) => l.account_code === code)
    .sort((a, b) => {
      const t = a.journal_entries.entry_date.localeCompare(b.journal_entries.entry_date);
      return t !== 0 ? t : a.journal_entries.entry_number.localeCompare(b.journal_entries.entry_number);
    });

  let chalta = opening;
  let totalDebit = 0;
  let totalCredit = 0;
  const lines: LedgerLine[] = meri.map((l) => {
    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    totalDebit += d;
    totalCredit += c;
    chalta = Math.round((chalta + (side === "debit" ? d - c : c - d)) * 100) / 100;
    return {
      entryId: l.entry_id,
      entryNumber: l.journal_entries.entry_number,
      entryDate: l.journal_entries.entry_date,
      description: l.journal_entries.description,
      memo: l.memo ?? null,
      partyType: l.party_type ?? null,
      debit: d,
      credit: c,
      balance: chalta,
    };
  });

  return {
    code,
    name: acc.name as string,
    accountType: acc.account_type as string,
    normalSide: side,
    opening,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    closing: chalta,
    lines,
  };
}
