import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { position } from "@/lib/ledger/reports";
import { Wallet, Boxes, Receipt, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

/**
 * Shaam ka Hisaab — din band karte waqt ka ek safha.
 *
 * Malik (6 September): *"backend par sab ke alag alag account hone
 * chahiyein. Hamein shaam ke time check karna hota hai — cash kitna, QR
 * kitna, Easypaisa kitna, JazzCash kitna, bank kitna. Us se sab maloom
 * ho jayega, phir total nikal aayega — kitna sale hua, kitna stock value
 * hai, kis kis khate mein kitni sale, ab kitna available hai."*
 *
 * 330 ne har tareeqe ko us ka apna khata diya. Ye safha unhen ek sath
 * dikhata hai.
 *
 * -------------------------------------------------------------------
 * YE SAFHA KOI NAYA ADAD NAHI BANATA
 *
 * Har khana `position()` se aata hai, jo trial balance par khaRa hai --
 * wohi qatarein jin par Cash Book, Money Trail aur Bank Reconcile
 * chalte hain.
 *
 * Agar ye safha apna alag hisaab lagata to ek din baqi safhon se hat
 * jata, aur phir do adad hote jin mein se koi nahi jaanta kaun sa sach
 * hai. Yehi ghalti Master Dashboard par pakRi gayi thi.
 *
 * -------------------------------------------------------------------
 * TEEN BAATEIN SAFHE PAR SAAF LIKHI HAIN
 *
 * 1. **Yahan kuch "theek" nahi hota.** Farq nikle to wo apni jagah par
 *    darj hota hai -- cash ka Cash Closing par, bank ka Bank Reconcile
 *    par -- wajah ke sath. Yahan se seedha adad badal dene ka khana
 *    dena wo pehli seerhi hoti jahan se "adjust kar dete hain" shuru
 *    hota hai.
 *
 * 2. **Stock ki qeemat godam ki GINTI se aati hai, ledger se nahi.**
 *    Ledger ka stock ka khata abhi bharosay ke qabil nahi -- kharid ki
 *    entry banti hi nahi thi. Safha ye baat chhupata nahi.
 *
 * 3. **"Aaj ki bikri" aur "aaj aaya hua paisa" do alag adad hain.**
 *    Khata (udhaar) wali bikri kisi khate mein nahi aati -- wo gahak ke
 *    zimme likhi jati hai. Inhen ek dikha dena har us din jhoot bolta
 *    hai jis din udhaar chala ho.
 */
export default async function ShaamKaHisaabPage() {
  const supabase = createClient();
  const service = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Finance, Manager ya Admin ke liye hai.</div>;
  }

  const aaj = new Date().toISOString().slice(0, 10);

  const [haalat, { data: accounts }, { data: aajKiBikri }, { data: adaigiyan }, { data: inventoryRows }] =
    await Promise.all([
      position(aaj),
      service.from("finance_accounts").select("name, gl_code, account_type").eq("is_active", true),
      service
        .from("pos_sales")
        .select("total_amount, khata_amount, cash_paid, discount_amount")
        .gte("created_at", `${aaj}T00:00:00`)
        .lte("created_at", `${aaj}T23:59:59`)
        .neq("status", "cancelled"),
      service
        .from("pos_sale_payment_details")
        .select("payment_method, amount, created_at")
        .gte("created_at", `${aaj}T00:00:00`)
        .lte("created_at", `${aaj}T23:59:59`),
      service.from("inventory").select("quantity_on_hand, products(purchase_price)"),
    ]);

  // Khate ka naam GL code se. Ledger sirf code jaanta hai; banda naam
  // jaanta hai -- aur shaam ko wo apni app ka naam dhoondh raha hota hai
  // ("JazzCash"), khata number nahi.
  const naamBaCode = new Map<string, string>(
    (accounts ?? [])
      .filter((a) => a.gl_code)
      .map((a) => [a.gl_code as string, a.name as string])
  );

  const khaate = (haalat.naqdiRows ?? []).map((r) => ({
    code: r.code,
    naam: naamBaCode.get(r.code) ?? r.name,
    raqam: r.amount,
  }));

  const kulBikri = (aajKiBikri ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const kulUdhaar = (aajKiBikri ?? []).reduce((s, r) => s + Number(r.khata_amount ?? 0), 0);
  const kulChhoot = (aajKiBikri ?? []).reduce((s, r) => s + Number(r.discount_amount ?? 0), 0);

  const tareeqe = new Map<string, number>();
  for (const p of adaigiyan ?? []) {
    const k = (p.payment_method as string | null) ?? "maloom nahi";
    tareeqe.set(k, (tareeqe.get(k) ?? 0) + Number(p.amount ?? 0));
  }
  const tareeqeRows = [...tareeqe.entries()]
    .map(([naam, raqam]) => ({ naam, raqam }))
    .sort((a, b) => b.raqam - a.raqam);

  // Godam ki ginti, TRADE (kharid) rate par. Malik ka usool: "supplier se
  // stock aaye ya hum individual transfer karein, wo hamesha trade rate
  // ke hisaab se count ho."
  let stockQeemat = 0;
  let binaRate = 0;
  for (const r of (inventoryRows ?? []) as { quantity_on_hand: number; products: unknown }[]) {
    const p = Array.isArray(r.products) ? r.products[0] : (r.products as { purchase_price?: number } | null);
    const rate = Number(p?.purchase_price ?? 0);
    const ginti = Number(r.quantity_on_hand ?? 0);
    if (ginti > 0 && !(rate > 0)) binaRate += 1;
    stockQeemat += ginti * rate;
  }

  const rs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shaam ka Hisaab"
        description="Din band karte waqt — har khate mein kitna hona chahiye, aur aaj kya hua"
      />

      {haalat.error && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Ledger ka jawab nahi mila — khaton ke adad bane hi nahi.
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">
            Ye adad SIFAR nahi hain, gine hi nahi ja sake: {haalat.error}
          </p>
        </Card>
      )}

      {/* ---- Har khate mein kitna hona chahiye ---- */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-surface-500" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            Har khate mein kitna hona chahiye
          </h2>
        </div>

        {khaate.length === 0 ? (
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {haalat.error
              ? "Jawab nahi mila."
              : "Kisi khate mein koi harkat nahi. Ye khali hai — sifar ka dawa nahi."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400 dark:border-surface-800">
                  <th className="py-2">Khata</th>
                  <th className="py-2 text-right">Nizam ke mutabiq</th>
                </tr>
              </thead>
              <tbody>
                {khaate.map((k) => (
                  <tr key={k.code} className="border-b border-surface-100 dark:border-surface-800">
                    <td className="py-2 text-surface-800 dark:text-surface-200">
                      {k.naam}
                      <span className="ms-2 text-xs text-surface-400">{k.code}</span>
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums text-surface-900 dark:text-white">
                      {rs(k.raqam)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-surface-300 dark:border-surface-700">
                  <td className="py-2 font-semibold text-surface-900 dark:text-white">Kul paisa</td>
                  <td className="py-2 text-right font-display text-lg font-bold tabular-nums text-surface-900 dark:text-white">
                    {haalat.naqdi === null ? "—" : rs(haalat.naqdi)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs leading-relaxed text-surface-500 dark:text-surface-400">
          Har app khol kar (JazzCash, Easypaisa, QR) us ka asal balance in adad se milayein.
          <strong className="ms-1">Yahan se kuch theek nahi hota</strong> — farq nikle to wo apni jagah
          par wajah ke sath darj hota hai.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href="/admin/cash-close"
            className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
          >
            Cash ki ginti <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/admin/bank-reconcile"
            className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
          >
            Bank ka milan <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>

      {/* ---- Aaj kya hua ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-surface-500" />
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Aaj ki bikri</h2>
          </div>

          <div className="space-y-1.5 text-sm">
            <p className="flex justify-between">
              <span className="text-surface-500">Kul bikri</span>
              <span className="font-semibold tabular-nums text-surface-900 dark:text-white">{rs(kulBikri)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-surface-500">Is mein se khata (udhaar)</span>
              <span className="tabular-nums text-amber-700 dark:text-amber-400">{rs(kulUdhaar)}</span>
            </p>
            {kulChhoot > 0 && (
              <p className="flex justify-between">
                <span className="text-surface-500">Chhoot di gayi</span>
                <span className="tabular-nums text-surface-600 dark:text-surface-400">{rs(kulChhoot)}</span>
              </p>
            )}
          </div>

          <p className="mt-3 border-t border-surface-100 pt-2 text-xs leading-relaxed text-surface-500 dark:border-surface-800 dark:text-surface-400">
            Khata wali bikri kisi khate mein nahi aati — wo gahak ke zimme likhi jati hai. Is liye
            &quot;aaj ki bikri&quot; aur &quot;aaj aaya hua paisa&quot; do alag adad hain.
          </p>

          <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
            Kis tareeqe se kitna aaya
          </h3>
          {tareeqeRows.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Aaj koi adaigi darj nahi hui.
            </p>
          ) : (
            <div className="space-y-1 text-sm">
              {tareeqeRows.map((t) => (
                <p key={t.naam} className="flex justify-between">
                  <span className="text-surface-600 dark:text-surface-400">{t.naam}</span>
                  <span className="font-medium tabular-nums text-surface-900 dark:text-white">{rs(t.raqam)}</span>
                </p>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-surface-500" />
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
              Godam mein kitne ka maal
            </h2>
          </div>

          <p className="font-display text-2xl font-bold text-surface-900 dark:text-white">{rs(stockQeemat)}</p>
          <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
            Godam ki ginti × <strong>kharid (trade) rate</strong>. Sale rate par ginne se ye adad us maal
            par munafa likh deta jo abhi bika hi nahi.
          </p>

          {binaRate > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {binaRate} cheezein aisi hain jin ka stock to hai magar kharid rate darj nahi — un ki qeemat is
              adad mein <strong>Rs 0</strong> gini gayi hai. Wo sifar ki nahi, un ka hisaab hi nahi rakha
              gaya. <Link href="/admin/products/bill-rates" className="underline">Bill Rates par rate bharein</Link>.
            </p>
          )}

          {haalat.stock !== null && Math.abs(stockQeemat - haalat.stock) > 1 && (
            <p className="mt-2 rounded-lg bg-surface-50 px-3 py-2 text-xs leading-relaxed text-surface-600 dark:bg-surface-800 dark:text-surface-400">
              Ledger ka stock ka khata (1200) <strong>{rs(haalat.stock)}</strong> kehta hai — farq{" "}
              <strong>{rs(stockQeemat - haalat.stock)}</strong>. Ooper wala adad godam ki ginti se hai aur
              wohi asal hai; ledger ka khata abhi poora nahi bhara.
            </p>
          )}
        </Card>
      </div>

      <p className="px-1 text-xs text-surface-400">
        Ye safha koi naya adad nahi banata — har khana ledger ki unhi qataron se ginta hai jin par Cash
        Book, Money Trail aur Bank Reconcile chalte hain.
      </p>
    </div>
  );
}
