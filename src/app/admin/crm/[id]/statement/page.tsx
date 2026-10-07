import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { formatDate } from "@/lib/utils/format";
import { StatementActions } from "./statement-actions";
import { partyBalanceAmount, partyBalanceLabel, partyBalanceStatus } from "@/lib/finance/party-balance";

export const dynamic = "force-dynamic";

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

/**
 * Ek gahak ka poora khata.
 *
 * =====================================================================
 * YE SAFHA KYUN BANA
 * =====================================================================
 *
 * Supplier, kisan, dealer, buyer, driver, investor -- sab ka statement
 * pehle se maujood tha. Gahak ka nahi. Yani CRM par sirf ek KUL adad
 * nazar aata tha ("Rs 5,000 dena hai") aur ye sawal kahin se jawab nahi
 * paata tha: *ye kab bana, aur is ne kab kya diya?*
 *
 * Malik (6 September): *"wo customer ke ledger mein jaye, har jagah wo
 * balance jayega, aur jab customer wo hamein wapas dega to wo bhi
 * indraj hona chahiye ke aaj aaya hai."*
 *
 * =====================================================================
 * LEDGER SE, SOURCE TABLES SE NAHI
 * =====================================================================
 *
 * Qatarein `fn_customer_ledger` se aati hain, jo 1100 ("Customer se
 * lena") par us gahak ki har qatar deti hai. Is ka faida ye hai ke har
 * raasta khud-ba-khud yahan aa jata hai: POS ka khata, load ka khata,
 * naqad udhaar, aur har wapsi. Source tables se banane ka matlab hota ke
 * naya raasta banne par statement chup chaap adhoora ho jata.
 *
 * Function `SECURITY DEFINER` hai (339) -- kyunki RLS ke peeche khali
 * jawab ko "sifar" samajh lena is project mein pehle bhi ghalat adad de
 * chuka hai.
 */
export async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone_number, credit_limit")
    .eq("id", id)
    .maybeSingle();

  // Opening balance: "from" tareekh se pehle ka poora hisaab, taake
  // is period ki fehrist sifar se shuru na ho jab gahak ka pehle se
  // hisaab chal raha ho.
  const openingEnd = sp.start ? new Date(`${sp.start}T00:00:00Z`) : null;
  if (openingEnd) openingEnd.setUTCDate(openingEnd.getUTCDate() - 1);
  const [{ data: rows }, { data: baqi }, { data: openingRows }, { data: allRows }] = await Promise.all([
    supabase.rpc("fn_customer_ledger", {
      p_customer: id,
      p_start: sp.start ?? undefined,
      p_end: sp.end ?? undefined,
    }),
    supabase.rpc("fn_customer_baqi", { p_customer: id }),
    sp.start
      ? supabase.rpc("fn_customer_ledger", { p_customer: id, p_start: undefined, p_end: openingEnd!.toISOString().slice(0, 10) })
      : Promise.resolve({ data: [] as any[] }),
    supabase.rpc("fn_customer_ledger", { p_customer: id, p_start: undefined, p_end: undefined }),
  ]);

  const qatarein = rows ?? [];
  const openingBalance = (openingRows ?? []).reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
  let chalta = openingBalance;
  const saathBalance = qatarein.map((r) => {
    chalta += Number(r.debit) - Number(r.credit);
    return { ...r, balance: chalta };
  });
  const kulLiya = qatarein.reduce((s, r) => s + Number(r.debit), 0);
  const kulDiya = qatarein.reduce((s, r) => s + Number(r.credit), 0);
  const signedBaqi = (allRows ?? []).reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
  const displayBalance = Number.isFinite(signedBaqi) ? signedBaqi : Number(baqi ?? 0);

  // Service history is visible even when paid cash/bank and no debt arose.
  // Only the 1100 ledger above determines the outstanding khata balance.
  let loadHistoryQuery = supabase.from("load_transactions")
    .select("id, txn_number, kind, principal, service_charge, payment_method, status, created_at, journal_entry_id")
    .eq("customer_id", id).order("created_at", { ascending: false }).limit(100);
  let bankHistoryQuery = (supabase as any).from("bank_transfer_transactions")
    .select("id, txn_number, principal, service_charge, receiving_method, status, created_at, journal_entry_id")
    .eq("customer_id", id).order("created_at", { ascending: false }).limit(100);
  if (sp.start) { loadHistoryQuery = loadHistoryQuery.gte("created_at", `${sp.start}T00:00:00+05:00`); bankHistoryQuery = bankHistoryQuery.gte("created_at", `${sp.start}T00:00:00+05:00`); }
  if (sp.end) { loadHistoryQuery = loadHistoryQuery.lte("created_at", `${sp.end}T23:59:59.999999+05:00`); bankHistoryQuery = bankHistoryQuery.lte("created_at", `${sp.end}T23:59:59.999999+05:00`); }
  const [loadHistory, bankHistory] = await Promise.all([loadHistoryQuery, bankHistoryQuery]);
  const serviceHistory = [
    ...(loadHistory.data ?? []).map((r) => ({ ...r, method: r.payment_method, service: r.kind === "bill" ? "Bill" : "Mobile Load" })),
    ...(bankHistory.data ?? []).map((r: any) => ({ ...r, method: r.receiving_method, service: "Bank Transfer" })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${customer?.name ?? "Gahak"} — Khata`}
        description="Har lena aur dena, tareekh ke sath — ledger se seedha."
      />

      <form className="flex flex-wrap items-end gap-2 rounded-card border border-surface-200 bg-white p-3 dark:border-surface-800 dark:bg-surface-900">
        <label className="text-xs text-surface-500">
          From
          <input type="date" name="start" defaultValue={sp.start} className="ml-2 rounded-lg border border-surface-200 px-2 py-1.5 dark:bg-surface-900" />
        </label>
        <label className="text-xs text-surface-500">
          To
          <input type="date" name="end" defaultValue={sp.end} className="ml-2 rounded-lg border border-surface-200 px-2 py-1.5 dark:bg-surface-900" />
        </label>
        <button type="submit" className="rounded-lg bg-surface-800 px-3 py-1.5 text-sm text-white">
          Apply
        </button>
      </form>

      <StatementActions customerId={id} start={sp.start} end={sp.end} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">Is ne liya (udhaar chaRha)</p>
          <p className="font-display text-xl font-semibold tabular-nums text-surface-900 dark:text-white">
            {rs(kulLiya)}
          </p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">Is ne diya (wapas kia)</p>
          <p className="font-display text-xl font-semibold tabular-nums text-surface-900 dark:text-white">
            {rs(kulDiya)}
          </p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">Abhi baqi</p>
          {/*
            NULL aur sifar alag likhe jate hain. `fn_customer_baqi` NULL
            deta hai jab gahak mile hi na ya ijazat na ho -- us ke saamne
            "Rs 0" likh dena jhoot hai (CLAUDE.md).
          */}
          <p className={`font-display text-xl font-semibold tabular-nums ${partyBalanceStatus(displayBalance) === "receivable" ? "text-red-700 dark:text-red-300" : partyBalanceStatus(displayBalance) === "payable" ? "text-amber-700 dark:text-amber-300" : "text-brand-700 dark:text-brand-300"}`}>
            {baqi === null ? "maloom nahi" : `${partyBalanceLabel(displayBalance)} — ${rs(partyBalanceAmount(displayBalance))}`}
          </p>
          {baqi === null && (
            <p className="mt-0.5 text-[11px] leading-snug text-surface-400">
              Ye gahak nahi mila — ya ye khata dekhne ki ijazat nahi.
            </p>
          )}
        </Card>
      </div>

      {sp.start && (
        <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800">
          Opening balance before {sp.start}: <strong>{rs(openingBalance)}</strong>
        </p>
      )}

      <Card className="p-0">
        {qatarein.length === 0 ? (
          <p className="px-5 py-8 text-sm text-surface-500 dark:text-surface-400">
            Is gahak ke khate mein abhi koi qatar nahi. Ye &ldquo;hisaab sifar hai&rdquo; nahi kehta — ye
            kehta hai ke is ka hisaab abhi shuru hi nahi hua.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/50">
                <tr>
                  <th className="px-4 py-2">Tareekh</th>
                  <th className="px-4 py-2">Entry</th>
                  <th className="px-4 py-2">Tafseel</th>
                  <th className="px-4 py-2 text-right">Liya</th>
                  <th className="px-4 py-2 text-right">Diya</th>
                  <th className="px-4 py-2 text-right">Baqi</th>
                </tr>
              </thead>
              <tbody>
                {saathBalance.map((r, i) => (
                  <tr key={`${r.entry_number}-${i}`} className="border-t border-surface-100 dark:border-surface-800">
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-surface-500">
                      {formatDate(r.entry_date)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.entry_number}</td>
                    <td className="px-4 py-2">{r.tafseel}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(r.debit) ? rs(Number(r.debit)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(r.credit) ? rs(Number(r.credit)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{rs(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Load, Bill aur Bank Transfer record</h2>
        <p className="mt-1 text-xs text-surface-500">Cash/bank se ada service ka record bhi yahan hai. Khate ka baqi upar ledger se hai.</p>
        {(loadHistory.error || bankHistory.error) && <p role="alert" className="mt-2 text-sm text-red-700">Service ka poora record nahi mil saka — Manager se check karwayein.</p>}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
          <thead><tr><th className="p-2 text-left">Tareekh / Receipt</th><th className="p-2 text-left">Service</th><th className="p-2 text-right">Raqam + fee</th><th className="p-2 text-left">Payment</th><th className="p-2 text-left">Ledger</th></tr></thead>
          <tbody>{serviceHistory.map((r) => <tr key={r.id} className="border-t border-surface-200">
            <td className="p-2">{formatDate(r.created_at)} · {r.txn_number}</td><td className="p-2">{r.service}{r.status === "wapas" ? " (wapas)" : ""}</td>
            <td className="p-2 text-right">{rs(Number(r.principal) + Number(r.service_charge ?? 0))}</td><td className="p-2">{r.method}</td>
            <td className="p-2">{r.journal_entry_id ? "Posted" : "Posting check zaroori"}</td>
          </tr>)}</tbody>
        </table>{!serviceHistory.length && !loadHistory.error && !bankHistory.error && <p className="p-2 text-sm text-surface-500">Is period mein service record nahi.</p>}</div>
      </Card>

      <p className="text-xs text-surface-500">
        <Link href="/admin/khata" className="underline">
          ← Customer Ledger par wapas
        </Link>
        {"  ·  "}
        Naya udhaar ya wapsi darj karni ho to{" "}
        <Link href="/admin/load-bill" className="underline">
          Load &amp; Bill → Udhaar
        </Link>
        .
      </p>
    </div>
  );
}

export default CustomerStatementPage;
