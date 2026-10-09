import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Statement Of Account -- bank ke statement jaisa, har khate ke liye.
 *
 * =====================================================================
 * YE FILE KYUN BANI (9 October)
 * =====================================================================
 *
 * Malik ne Bank Alfalah ke asal statement ki tasveer bheji: Sr #, Post
 * Date, Value Date, Account No., Doc No., Details, Withdrawal, Deposit,
 * Balance. "Is tarah hamara ledger aana chahiye -- sab kuch clear."
 *
 * Paise ke do register hain (dekho `cash-book.ts`):
 *   * Ledger (`journal_lines`, khate ka GL code)
 *   * Cash Book (`finance_transactions`, khate ki id)
 *
 * Ye safha DONO ko ek hi shakal mein dikhata hai, aur har qatar par
 * batata hai ke doosre register mein us ka jorr mila ya nahi (jorr
 * `journal_entry_sources` se, aur grain payments ke apne
 * `journal_entry_id` / `finance_transaction_id` se). Dono ka closing
 * alag ho to safhe par surkh tanbeeh aati hai -- chhupaya nahi jata.
 *
 * Sirf PARHTA hai. Kuch likhta nahi, koi migration nahi.
 *
 * Post Date = entry kab likhi gayi (created_at, Pakistan waqt).
 * Value Date = karobar ki tareekh (purani tareekh bhi ho sakti hai).
 */

export type SoaView = "gl" | "cb";

export interface SoaRow {
  key: string;
  sr: number;
  postDate: string; // "YYYY-MM-DD HH:mm" PKT
  valueDate: string; // YYYY-MM-DD
  account: string;
  docNo: string;
  docHref: string | null;
  /** Doosre register ka hawala (GL view mein cash book, CB view mein TXN). */
  linkedRef: string | null;
  /** Doosre register mein jorr mila ya nahi. */
  linked: boolean;
  details: string;
  sourceLabel: string | null;
  sourceHref: string | null;
  partyName: string | null;
  partyHref: string | null;
  backdated: boolean;
  withdrawal: number;
  deposit: number;
  balance: number;
}

export interface SoaSide {
  opening: number;
  closing: number;
  totalWithdrawal: number;
  totalDeposit: number;
  rows: SoaRow[];
  unlinked: number;
}

export interface SoaAccountOption {
  value: string; // "fa:<uuid>" ya "gl:<code>"
  label: string;
  group: "finance" | "gl";
}

export interface StatementOfAccount {
  accountValue: string;
  accountLabel: string;
  accountNumber: string | null;
  glCode: string | null;
  financeAccountId: string | null;
  normalSide: "debit" | "credit";
  from: string;
  to: string;
  gl: SoaSide | null;
  cb: SoaSide | null;
  options: SoaAccountOption[];
  error?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function pkt(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Date(d.getTime() + 5 * 3600 * 1000);
  return p.toISOString().slice(0, 16).replace("T", " ");
}

/** Supabase ek dafa mein 1000 qatarein deta hai -- is liye safha ba safha. */
async function allRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<{ rows: T[]; error: string | null }> {
  const out: T[] = [];
  const size = 1000;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await build(i * size, i * size + size - 1);
    if (error) return { rows: out, error: error.message };
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return { rows: out, error: null };
}

function chunks<T>(list: T[], n = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

async function inChunks<T>(ids: string[], run: (part: string[]) => PromiseLike<{ data: T[] | null; error?: unknown }>): Promise<T[]> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  const out: T[] = [];
  for (const part of chunks(uniq)) {
    const { data } = await run(part);
    out.push(...(data ?? []));
  }
  return out;
}

const PARTY_TABLE: Record<string, { table: string; column: string; href: (id: string) => string }> = {
  farmer: { table: "farmers", column: "full_name", href: (id) => `/admin/farmers/${id}/statement` },
  supplier: { table: "suppliers", column: "name", href: (id) => `/admin/suppliers/${id}/statement` },
  customer: { table: "customers", column: "name", href: (id) => `/admin/crm/${id}/statement` },
  dealer: { table: "dealers", column: "business_name", href: () => `/admin/dealers` },
  staff: { table: "profiles", column: "full_name", href: () => `/admin/staff-khata` },
  branch: { table: "branches", column: "name", href: () => `/admin/branch-credit` },
};

/** Entry kis kaam se bani -- label aur us kaam ka safha. */
const MODULES: { match: (m: string) => boolean; label: string; href: string }[] = [
  { match: (m) => m.startsWith("grain_sale"), label: "Grain Sale", href: "/admin/grain-procurement/sell" },
  { match: (m) => m.startsWith("grain"), label: "Grain Kharid", href: "/admin/grain-procurement/payments" },
  { match: (m) => m === "pos" || m.startsWith("pos_"), label: "POS", href: "/admin/pos" },
  { match: (m) => m === "load_bill", label: "Load / Bill", href: "/admin/load-bill" },
  { match: (m) => m.startsWith("supplier_payment"), label: "Supplier Payment", href: "/admin/suppliers" },
  { match: (m) => m === "purchase" || m === "grn" || m.startsWith("purchase_"), label: "Kharid (Purchase)", href: "/admin/purchases" },
  { match: (m) => m.startsWith("machinery"), label: "Machinery", href: "/admin/machinery-rental" },
  { match: (m) => m.startsWith("customer_") || m === "recovery", label: "Udhaar / Wasooli", href: "/admin/khata" },
  { match: (m) => m === "branch_credit", label: "Branch Credit", href: "/admin/branch-credit" },
  { match: (m) => m === "staff_khata", label: "Staff Khata", href: "/admin/staff-khata" },
  { match: (m) => m === "cash_handover", label: "Cash Handover", href: "/admin/cash-handover" },
  { match: (m) => m.startsWith("stock_"), label: "Stock Count", href: "/admin/stock-count" },
  { match: (m) => m === "agri_dispatch", label: "Agri Dispatch", href: "/admin/agri-orders" },
  { match: (m) => m === "farmer_credit", label: "Kisan Udhaar", href: "/admin/farmer-credit" },
  { match: (m) => m.includes("transfer"), label: "Transfer", href: "/admin/finance" },
  { match: (m) => m === "reversal", label: "Reversal", href: "/admin/audit-trail" },
  { match: () => true, label: "Finance", href: "/admin/finance" },
];

function moduleOf(sourceModule: string | null | undefined, text: string): { label: string; href: string } {
  const m = (sourceModule ?? "").toLowerCase();
  const t = text.toLowerCase();
  // Purani grain payments "finance" module se darj hui thin -- naam se pehchano.
  if (/grn-sale-/i.test(text) || t.includes("grain sale") || t.includes("grain bikri")) return MODULES[0];
  if (t.includes("grain kharid") || t.includes("grain payment") || t.includes("grain procurement")) return MODULES[1];
  const hit = MODULES.find((x) => x.match(m)) ?? MODULES[MODULES.length - 1];
  return { label: hit.label, href: hit.href };
}

function journalHref(date: string): string {
  return `/admin/finance/statements?view=journal&from=${date}&to=${date}`;
}

function joinParts(parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const s = (p ?? "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    // Ek hissa doosre mein poora mojood ho to dohrao mat.
    if (out.some((o) => o.toLowerCase().includes(k))) continue;
    seen.add(k);
    out.push(s);
  }
  return out.join(" | ");
}

type Db = SupabaseClient;

interface GrainInfo {
  label: string;
  saleNumber: string | null;
  partyName: string | null;
  partyHref: string | null;
  sourceHref: string;
}

/** Grain payments: sale number aur khareedar / kisan ka naam. */
async function grainLookup(db: Db, ftIds: string[], entryIds: string[], saleNumbers: string[]) {
  const byFt = new Map<string, GrainInfo>();
  const byEntry = new Map<string, GrainInfo>();
  const bySaleNo = new Map<string, GrainInfo>();

  const [spFt, spJe, ppFt, ppJe, salesByNo] = await Promise.all([
    inChunks<any>(ftIds, (p) => db.from("grain_sale_payments").select("id, sale_id, finance_transaction_id, journal_entry_id").in("finance_transaction_id", p)),
    inChunks<any>(entryIds, (p) => db.from("grain_sale_payments").select("id, sale_id, finance_transaction_id, journal_entry_id").in("journal_entry_id", p)),
    inChunks<any>(ftIds, (p) => db.from("grain_procurement_payments").select("id, farmer_id, party_id, finance_transaction_id, journal_entry_id").in("finance_transaction_id", p)),
    inChunks<any>(entryIds, (p) => db.from("grain_procurement_payments").select("id, farmer_id, party_id, finance_transaction_id, journal_entry_id").in("journal_entry_id", p)),
    inChunks<any>(saleNumbers, (p) => db.from("grain_sales").select("id, sale_number, buyer_id").in("sale_number", p)),
  ]);

  const saleIds = [...spFt, ...spJe].map((s) => s.sale_id);
  const sales = [...salesByNo, ...(await inChunks<any>(saleIds, (p) => db.from("grain_sales").select("id, sale_number, buyer_id").in("id", p)))];
  const buyers = await inChunks<any>(sales.map((s) => s.buyer_id), (p) => db.from("buyers").select("id, business_name").in("id", p));
  const buyerName = new Map(buyers.map((b) => [b.id as string, b.business_name as string]));
  const saleById = new Map(sales.map((s) => [s.id as string, s]));

  const saleInfo = (sale: any): GrainInfo => ({
    label: "Grain Sale",
    saleNumber: sale?.sale_number ?? null,
    partyName: sale ? buyerName.get(sale.buyer_id) ?? null : null,
    partyHref: sale?.buyer_id ? `/admin/buyers/${sale.buyer_id}/statement` : null,
    sourceHref: "/admin/grain-procurement/sell",
  });
  for (const s of sales) bySaleNo.set(s.sale_number, saleInfo(s));
  for (const p of [...spFt, ...spJe]) {
    const info = { ...saleInfo(saleById.get(p.sale_id)), label: "Grain Sale wasooli" };
    if (p.finance_transaction_id) byFt.set(p.finance_transaction_id, info);
    if (p.journal_entry_id) byEntry.set(p.journal_entry_id, info);
  }

  const pp = [...ppFt, ...ppJe];
  const [farmers, parties] = await Promise.all([
    inChunks<any>(pp.map((p) => p.farmer_id), (p) => db.from("farmers").select("id, full_name").in("id", p)),
    inChunks<any>(pp.map((p) => p.party_id), (p) => db.from("grain_parties").select("id, party_name").in("id", p)),
  ]);
  const farmerName = new Map(farmers.map((f) => [f.id as string, f.full_name as string]));
  const partyName = new Map(parties.map((f) => [f.id as string, f.party_name as string]));
  for (const p of pp) {
    const info: GrainInfo = {
      label: "Grain Kharid adaigi",
      saleNumber: null,
      partyName: (p.farmer_id && farmerName.get(p.farmer_id)) || (p.party_id && partyName.get(p.party_id)) || null,
      partyHref: p.farmer_id ? `/admin/farmers/${p.farmer_id}/statement` : null,
      sourceHref: `/admin/grain-procurement/payment-slip/${p.id}`,
    };
    if (p.finance_transaction_id) byFt.set(p.finance_transaction_id, info);
    if (p.journal_entry_id) byEntry.set(p.journal_entry_id, info);
  }
  return { byFt, byEntry, bySaleNo };
}

const SALE_NO = /GRN-SALE-\d+-\d+/i;

export async function loadStatementOfAccount(params: { account?: string; from: string; to: string }): Promise<StatementOfAccount> {
  const db = createServiceClient() as unknown as Db;
  const { from, to } = params;

  const [{ data: fas }, { data: gls }] = await Promise.all([
    db.from("finance_accounts").select("id, name, account_type, gl_code, account_number, opening_balance, is_active").order("gl_code"),
    db.from("gl_accounts").select("code, name, normal_side, is_active, sort_order").eq("is_active", true).order("sort_order"),
  ]);
  const financeAccounts = (fas ?? []) as any[];
  const glAccounts = (gls ?? []) as any[];

  const options: SoaAccountOption[] = [
    ...financeAccounts
      .filter((a) => a.is_active)
      .map((a) => ({ value: `fa:${a.id}`, label: `${a.name}${a.gl_code ? ` (${a.gl_code})` : ""}`, group: "finance" as const })),
    ...glAccounts.map((g) => ({ value: `gl:${g.code}`, label: `${g.code} · ${g.name}`, group: "gl" as const })),
  ];

  const defaultValue = options[0]?.value ?? "";
  const accountValue = params.account && options.some((o) => o.value === params.account) ? params.account : defaultValue;

  let fa: any = null;
  let glCode: string | null = null;
  if (accountValue.startsWith("fa:")) {
    fa = financeAccounts.find((a) => a.id === accountValue.slice(3)) ?? null;
    glCode = fa?.gl_code ?? null;
  } else if (accountValue.startsWith("gl:")) {
    glCode = accountValue.slice(3);
    // Is GL code ka ek hi finance khata ho to us ki Cash Book bhi saath.
    const same = financeAccounts.filter((a) => a.gl_code === glCode);
    if (same.length === 1) fa = same[0];
  }
  const gl = glAccounts.find((g) => g.code === glCode) ?? null;
  const normalSide: "debit" | "credit" = gl?.normal_side === "credit" ? "credit" : "debit";
  const accountLabel = fa ? fa.name : gl ? `${gl.code} · ${gl.name}` : "—";
  const accountShort = fa ? `${fa.account_number || fa.name}` : gl ? `${gl.code} ${gl.name}` : "";

  const base: StatementOfAccount = {
    accountValue,
    accountLabel,
    accountNumber: fa?.account_number ?? null,
    glCode,
    financeAccountId: fa?.id ?? null,
    normalSide,
    from,
    to,
    gl: null,
    cb: null,
    options,
  };
  if (!accountValue) return { ...base, error: "Koi khata nahi mila." };

  // ------------------------------------------------------------------
  // Ledger (GL) ki qatarein
  // ------------------------------------------------------------------
  type JL = {
    id: string;
    entry_id: string;
    debit: number | string | null;
    credit: number | string | null;
    memo: string | null;
    party_type: string | null;
    party_id: string | null;
    journal_entries: { entry_number: string; entry_date: string; description: string | null; source_module: string | null; source_id: string | null; created_at: string; is_backdated: boolean | null };
  };
  type FT = { id: string; transaction_type: string; category: string | null; amount: number | string; transaction_date: string; notes: string | null; created_at: string };

  const [glRes, cbRes] = await Promise.all([
    glCode
      ? allRows<JL>((a, b) =>
          db
            .from("journal_lines")
            .select("id, entry_id, debit, credit, memo, party_type, party_id, journal_entries!inner(entry_number, entry_date, description, source_module, source_id, created_at, is_backdated)")
            .eq("account_code", glCode)
            .lte("journal_entries.entry_date", to)
            .order("id")
            .range(a, b) as any
        )
      : Promise.resolve({ rows: [] as JL[], error: null }),
    fa
      ? allRows<FT>((a, b) =>
          db
            .from("finance_transactions")
            .select("id, transaction_type, category, amount, transaction_date, notes, created_at")
            .eq("account_id", fa.id)
            .lte("transaction_date", to)
            .order("id")
            .range(a, b) as any
        )
      : Promise.resolve({ rows: [] as FT[], error: null }),
  ]);
  if (glRes.error || cbRes.error) return { ...base, error: glRes.error ?? cbRes.error ?? "maloom nahi" };

  const glPeriod = glRes.rows.filter((l) => l.journal_entries.entry_date >= from);
  const cbPeriod = cbRes.rows.filter((t) => t.transaction_date >= from);

  // Jorr: cash book qatar <-> ledger entry.
  const entryIds = glPeriod.map((l) => l.entry_id);
  const ftIds = cbPeriod.map((t) => t.id);
  const [srcByEntry, srcByFt, siblingLines] = await Promise.all([
    inChunks<any>(entryIds, (p) => db.from("journal_entry_sources").select("entry_id, source_table, source_row_id").in("entry_id", p)),
    inChunks<any>(ftIds, (p) => db.from("journal_entry_sources").select("entry_id, source_table, source_row_id").eq("source_table", "finance_transactions").in("source_row_id", p)),
    inChunks<any>(entryIds, (p) => db.from("journal_lines").select("entry_id, account_code, party_type, party_id, memo").in("entry_id", p)),
  ]);

  const saleNos = new Set<string>();
  for (const l of glPeriod) {
    const m = `${l.journal_entries.description ?? ""} ${l.memo ?? ""}`.match(SALE_NO);
    if (m) saleNos.add(m[0].toUpperCase());
  }
  for (const t of cbPeriod) {
    const m = `${t.notes ?? ""}`.match(SALE_NO);
    if (m) saleNos.add(m[0].toUpperCase());
  }

  // Doosri taraf ke ft ids aur entry ids -- grain dhoondne ke liye.
  const ftFromEntries = srcByEntry.filter((s) => s.source_table === "finance_transactions").map((s) => s.source_row_id as string);
  const entriesFromFt = srcByFt.map((s) => s.entry_id as string);
  const grain = await grainLookup(db, [...ftIds, ...ftFromEntries], [...entryIds, ...entriesFromFt], Array.from(saleNos));

  // ft id -> entry ids, entry -> ft ids
  const entryOfFt = new Map<string, string[]>();
  for (const s of srcByFt) entryOfFt.set(s.source_row_id, [...(entryOfFt.get(s.source_row_id) ?? []), s.entry_id]);
  const ftOfEntry = new Map<string, string[]>();
  for (const s of srcByEntry) if (s.source_table === "finance_transactions") ftOfEntry.set(s.entry_id, [...(ftOfEntry.get(s.entry_id) ?? []), s.source_row_id]);
  // grain payment rows bhi jorr mante hain
  const grainEntryOfFt = new Map<string, string>();
  const [gspFt, gppFt] = await Promise.all([
    inChunks<any>(ftIds, (p) => db.from("grain_sale_payments").select("finance_transaction_id, journal_entry_id").in("finance_transaction_id", p)),
    inChunks<any>(ftIds, (p) => db.from("grain_procurement_payments").select("finance_transaction_id, journal_entry_id").in("finance_transaction_id", p)),
  ]);
  for (const g of [...gspFt, ...gppFt]) if (g.journal_entry_id) grainEntryOfFt.set(g.finance_transaction_id, g.journal_entry_id);

  // Entry numbers for linked entries (cash-book view ke liye).
  const allLinkedEntryIds = Array.from(new Set([...entriesFromFt, ...Array.from(grainEntryOfFt.values())]));
  const linkedEntries = await inChunks<any>(allLinkedEntryIds, (p) => db.from("journal_entries").select("id, entry_number, entry_date, description, source_module").in("id", p));
  const entryById = new Map(linkedEntries.map((e) => [e.id as string, e]));

  // Party naam: bank wali qatar par party kam hoti hai -- usi entry ki
  // doosri qatar (lena/dena) par hoti hai.
  const partyOfEntry = new Map<string, { type: string; id: string }>();
  for (const s of siblingLines) if (s.party_type && s.party_id && !partyOfEntry.has(s.entry_id)) partyOfEntry.set(s.entry_id, { type: s.party_type, id: s.party_id });
  for (const l of glPeriod) if (l.party_type && l.party_id) partyOfEntry.set(l.entry_id, { type: l.party_type, id: l.party_id });
  const partyNames = new Map<string, string>();
  const byType = new Map<string, string[]>();
  for (const p of partyOfEntry.values()) byType.set(p.type, [...(byType.get(p.type) ?? []), p.id]);
  await Promise.all(
    Array.from(byType.entries()).map(async ([type, ids]) => {
      const meta = PARTY_TABLE[type];
      if (!meta) return;
      const rows = await inChunks<any>(ids, (p) => db.from(meta.table).select(`id, ${meta.column}`).in("id", p));
      for (const r of rows) partyNames.set(`${type}:${r.id}`, r[meta.column]);
    })
  );

  // Ft id -> cash book ka chhota hawala (CB-xxxxxxxx)
  const cbRef = (id: string) => `CB-${id.slice(0, 8).toUpperCase()}`;

  // ---------------- GL side ----------------
  let glSide: SoaSide | null = null;
  if (glCode) {
    const sign = (d: number, c: number) => (normalSide === "debit" ? d - c : c - d);
    let opening = 0;
    for (const l of glRes.rows) if (l.journal_entries.entry_date < from) opening += sign(Number(l.debit ?? 0), Number(l.credit ?? 0));
    opening = r2(opening);
    const sorted = [...glPeriod].sort(
      (a, b) =>
        a.journal_entries.entry_date.localeCompare(b.journal_entries.entry_date) ||
        a.journal_entries.created_at.localeCompare(b.journal_entries.created_at) ||
        a.journal_entries.entry_number.localeCompare(b.journal_entries.entry_number)
    );
    let bal = opening;
    let tw = 0;
    let td = 0;
    let unlinked = 0;
    const rows: SoaRow[] = sorted.map((l, i) => {
      const je = l.journal_entries;
      const d = Number(l.debit ?? 0);
      const c = Number(l.credit ?? 0);
      const delta = sign(d, c);
      const deposit = delta > 0 ? r2(delta) : 0;
      const withdrawal = delta < 0 ? r2(-delta) : 0;
      bal = r2(bal + delta);
      tw += withdrawal;
      td += deposit;
      const fts = ftOfEntry.get(l.entry_id) ?? [];
      const g = grain.byEntry.get(l.entry_id) ?? fts.map((f) => grain.byFt.get(f)).find(Boolean) ?? null;
      const text = `${je.description ?? ""} ${l.memo ?? ""}`;
      const saleNo = text.match(SALE_NO)?.[0]?.toUpperCase() ?? g?.saleNumber ?? null;
      const gs = g ?? (saleNo ? grain.bySaleNo.get(saleNo) ?? null : null);
      const mod = gs
        ? { label: gs.label === "Grain Sale" && deposit > 0 ? "Grain Sale wasooli" : gs.label, href: gs.sourceHref }
        : moduleOf(je.source_module, text);
      const party = partyOfEntry.get(l.entry_id);
      const pName = gs?.partyName ?? (party ? partyNames.get(`${party.type}:${party.id}`) ?? null : null);
      const pHref = gs?.partyHref ?? (party && PARTY_TABLE[party.type] ? PARTY_TABLE[party.type].href(party.id) : null);
      const srcHref =
        je.source_module === "grain_procurement" && je.source_id ? `/admin/grain-procurement/bill/${je.source_id}` : mod.href;
      // Jorr: cash book ki qatar mili? Sirf GL wala khata (jis ki finance
      // account na ho) ho to ye sawal hi nahi.
      if (fa && fts.length === 0) unlinked++;
      return {
        key: `gl-${l.id}`,
        sr: i + 1,
        postDate: pkt(je.created_at),
        valueDate: je.entry_date,
        account: accountShort,
        docNo: je.entry_number,
        docHref: journalHref(je.entry_date),
        linkedRef: fts.length > 0 ? fts.map(cbRef).join(", ") : null,
        linked: fa ? fts.length > 0 : true,
        details: joinParts([mod.label, saleNo, pName, je.description, l.memo]),
        sourceLabel: mod.label,
        sourceHref: srcHref,
        partyName: pName,
        partyHref: pHref,
        backdated: !!je.is_backdated || (je.created_at ? pkt(je.created_at).slice(0, 10) > je.entry_date : false),
        withdrawal,
        deposit,
        balance: bal,
      };
    });
    glSide = { opening, closing: bal, totalWithdrawal: r2(tw), totalDeposit: r2(td), rows, unlinked };
  }

  // ---------------- Cash book side ----------------
  let cbSide: SoaSide | null = null;
  if (fa) {
    const isIn = (t: string) => t === "income" || t === "transfer_in" || t.endsWith("_in");
    const signed = (t: FT) => (isIn(String(t.transaction_type)) ? Number(t.amount) : -Number(t.amount));
    let opening = Number(fa.opening_balance ?? 0);
    for (const t of cbRes.rows) if (t.transaction_date < from) opening += signed(t);
    opening = r2(opening);
    const sorted = [...cbPeriod].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.created_at.localeCompare(b.created_at));
    let bal = opening;
    let tw = 0;
    let td = 0;
    let unlinked = 0;
    const rows: SoaRow[] = sorted.map((t, i) => {
      const delta = signed(t);
      const deposit = delta > 0 ? r2(delta) : 0;
      const withdrawal = delta < 0 ? r2(-delta) : 0;
      bal = r2(bal + delta);
      tw += withdrawal;
      td += deposit;
      const eIds = [...(entryOfFt.get(t.id) ?? []), ...(grainEntryOfFt.has(t.id) ? [grainEntryOfFt.get(t.id)!] : [])];
      const entries = Array.from(new Set(eIds)).map((id) => entryById.get(id)).filter(Boolean) as any[];
      if (entries.length === 0) unlinked++;
      const text = `${t.category ?? ""} ${t.notes ?? ""}`;
      const g = grain.byFt.get(t.id) ?? null;
      const saleNo = text.match(SALE_NO)?.[0]?.toUpperCase() ?? g?.saleNumber ?? null;
      const gs = g ?? (saleNo ? grain.bySaleNo.get(saleNo) ?? null : null);
      const mod = gs
        ? { label: gs.label === "Grain Sale" && deposit > 0 ? "Grain Sale wasooli" : gs.label, href: gs.sourceHref }
        : moduleOf(entries[0]?.source_module ?? t.category, text);
      const first = entries[0];
      return {
        key: `cb-${t.id}`,
        sr: i + 1,
        postDate: pkt(t.created_at),
        valueDate: t.transaction_date,
        account: accountShort,
        docNo: first ? first.entry_number : cbRef(t.id),
        docHref: first ? journalHref(first.entry_date) : null,
        linkedRef: entries.length > 0 ? entries.map((e) => e.entry_number).join(", ") : null,
        linked: entries.length > 0,
        details: joinParts([mod.label, saleNo, gs?.partyName, t.category, t.notes]),
        sourceLabel: mod.label,
        sourceHref: mod.href,
        partyName: gs?.partyName ?? null,
        partyHref: gs?.partyHref ?? null,
        backdated: pkt(t.created_at).slice(0, 10) > t.transaction_date,
        withdrawal,
        deposit,
        balance: bal,
      };
    });
    cbSide = { opening, closing: bal, totalWithdrawal: r2(tw), totalDeposit: r2(td), rows, unlinked };
  }

  return { ...base, gl: glSide, cb: cbSide };
}

