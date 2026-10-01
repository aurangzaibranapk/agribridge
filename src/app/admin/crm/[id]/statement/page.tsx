import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { StatementActions } from "./statement-actions";
import { StatementTable } from "./statement-table";

export const dynamic = "force-dynamic";

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

type SaleItem = { product_name: string; quantity: number; unit_price: number; subtotal: number };

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

  // Opening balance: "from" tareekh se pehle ka poora hisaab, taake
  // is period ki fehrist sifar se shuru na ho jab gahak ka pehle se
  // hisaab chal raha ho.
  const openingEnd = sp.start ? new Date(`${sp.start}T00:00:00Z`) : null;
  if (openingEnd) openingEnd.setUTCDate(openingEnd.getUTCDate() - 1);
  const [{ data: rows }, { data: baqi }, { data: openingRows }] = await Promise.all([
    supabase.rpc("fn_customer_ledger", {
      p_customer: id,
      p_start: sp.start ?? undefined,
      p_end: sp.end ?? undefined,
    }),
    supabase.rpc("fn_customer_baqi", { p_customer: id }),
    sp.start
      ? supabase.rpc("fn_customer_ledger", { p_customer: id, p_start: undefined, p_end: openingEnd!.toISOString().slice(0, 10) })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // source_id migration 485 ke baad DB mein hai — types regenerate hone tak any cast
  type RawRow = { entry_date: string; entry_number: string; tafseel: string; module: string; source_id: string | null; debit: number; credit: number };
  const qatarein = (rows ?? []) as unknown as RawRow[];
  const openingBalance = (openingRows ?? []).reduce((s, r: any) => s + Number(r.debit) - Number(r.credit), 0);
  let chalta = openingBalance;
  const saathBalance = qatarein.map((r) => {
    chalta += Number(r.debit) - Number(r.credit);
    return { ...r, balance: chalta };
  });
  // POS rows ke liye items + sale data batch-fetch: source_id wali qatarein
  const posSourceIds = qatarein
    .filter((r) => r.module === "pos" && r.source_id)
    .map((r) => r.source_id as string);

  let itemsMap: Record<string, SaleItem[]> = {};
  let salesMap: Record<string, { total_amount: number; cash_paid: number }> = {};

  if (posSourceIds.length > 0) {
    const [{ data: saleItems }, { data: salesData }] = await Promise.all([
      supabase
        .from("pos_sale_items")
        .select("sale_id, quantity, unit_price, subtotal, products(name)")
        .in("sale_id", posSourceIds),
      supabase
        .from("pos_sales")
        .select("id, total_amount, cash_paid")
        .in("id", posSourceIds),
    ]);
    if (saleItems) {
      for (const item of saleItems) {
        const sid = item.sale_id as string;
        if (!itemsMap[sid]) itemsMap[sid] = [];
        itemsMap[sid].push({
          product_name: (item.products as any)?.name ?? "—",
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        });
      }
    }
    if (salesData) {
      for (const sale of salesData) {
        salesMap[sale.id] = { total_amount: Number(sale.total_amount), cash_paid: Number(sale.cash_paid) };
      }
    }
  }

  // kulLiya / kulDiya: POS split payment mein poori sale + cash payment dono dikhao
  // (balance delta wahi rehta hai: total_amount - cash_paid = khata_amount = journal debit)
  const kulLiya = qatarein.reduce((s, r) => {
    const sale = r.source_id ? salesMap[r.source_id] : undefined;
    return s + (sale ? sale.total_amount : Number(r.debit));
  }, 0);
  const kulDiya = qatarein.reduce((s, r) => {
    const sale = r.source_id ? salesMap[r.source_id] : undefined;
    return s + (sale ? sale.cash_paid : 0) + Number(r.credit);
  }, 0);

  const printDate = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });
  const periodLabel = sp.start && sp.end
    ? `${sp.start} se ${sp.end} tak`
    : sp.start
    ? `${sp.start} se aaj tak`
    : sp.end
    ? `Shuru se ${sp.end} tak`
    : "Tamam entries";

  return (
    <div className="space-y-4">

      {/* Print-only professional letterhead */}
      <div className="hidden print:block mb-6 border-b-2 border-black pb-4">
        <div className="text-center mb-3">
          <h1 className="text-2xl font-bold tracking-wide">KISAN ECO MAHABALI</h1>
          <p className="text-sm">Main Branch · Jhang</p>
          <p className="text-xs text-gray-500">www.alranatraders.pk</p>
          <p className="text-base font-semibold mt-1">CUSTOMER ACCOUNT STATEMENT — KHATA BAYAAN</p>
        </div>
        <div className="flex justify-between text-sm border-t border-gray-300 pt-2">
          <div>
            <p><strong>Gahak / Customer:</strong> {customer?.name ?? "—"}</p>
            {customer?.phone_number && <p><strong>Phone:</strong> {customer.phone_number}</p>}
          </div>
          <div className="text-right">
            <p><strong>Print Date:</strong> {printDate}</p>
            <p><strong>Period:</strong> {periodLabel}</p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title={`${customer?.name ?? "Gahak"} — Khata`}
          description="Har lena aur dena, tareekh ke sath — ledger se seedha."
        />
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-card border border-surface-200 bg-white p-3 dark:border-surface-800 dark:bg-surface-900 print:hidden">
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

      <StatementActions
        customerId={id}
        start={sp.start}
        end={sp.end}
        waData={{
          phone: customer?.phone_number ?? null,
          name: customer?.name ?? "Gahak",
          baqi: baqi ?? null,
          kulLiya,
          kulDiya,
        }}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">Kul khareed (maal liya)</p>
          <p className="font-display text-xl font-semibold tabular-nums text-surface-900 dark:text-white">
            {rs(kulLiya)}
          </p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">Kul ada kiya (cash + wapsi)</p>
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
          <StatementTable rows={saathBalance} itemsMap={itemsMap} salesMap={salesMap} />
        )}
      </Card>

      <p className="text-xs text-surface-500 print:hidden">
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
      {/* Print footer */}
      <div className="hidden print:block mt-6 border-t border-gray-300 pt-3 text-xs text-gray-500 flex justify-between">
        <span>Al Rana Traders — Khata Bayaan</span>
        <span>Print Date: {printDate}</span>
      </div>
    </div>
  );
}
