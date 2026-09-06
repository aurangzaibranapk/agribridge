import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { formatDate } from "@/lib/utils/format";

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
export default async function CustomerStatementPage({
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

  const [{ data: rows }, { data: baqi }] = await Promise.all([
    supabase.rpc("fn_customer_ledger", {
      p_customer: id,
      p_start: sp.start ?? undefined,
      p_end: sp.end ?? undefined,
    }),
    supabase.rpc("fn_customer_baqi", { p_customer: id }),
  ]);

  const qatarein = rows ?? [];
  let chalta = 0;
  const saathBalance = qatarein.map((r) => {
    chalta += Number(r.debit) - Number(r.credit);
    return { ...r, balance: chalta };
  });
  const kulLiya = qatarein.reduce((s, r) => s + Number(r.debit), 0);
  const kulDiya = qatarein.reduce((s, r) => s + Number(r.credit), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${customer?.name ?? "Gahak"} — Khata`}
        description="Har lena aur dena, tareekh ke sath — ledger se seedha."
      />

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
          <p
            className={`font-display text-xl font-semibold tabular-nums ${
              baqi === null
                ? "text-surface-400"
                : Number(baqi) > 0
                  ? "text-red-700 dark:text-red-300"
                  : "text-brand-700 dark:text-brand-300"
            }`}
          >
            {baqi === null ? "maloom nahi" : rs(Number(baqi))}
          </p>
          {baqi === null && (
            <p className="mt-0.5 text-[11px] leading-snug text-surface-400">
              Ye gahak nahi mila — ya ye khata dekhne ki ijazat nahi.
            </p>
          )}
        </Card>
      </div>

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

      <p className="text-xs text-surface-500">
        <Link href="/admin/crm" className="underline">
          ← CRM par wapas
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
