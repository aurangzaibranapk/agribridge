import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { KhataPaymentRow } from "./payment-row";

export const dynamic = "force-dynamic";

/**
 * Ek kisan ka machinery ka khata -- lakeer ba lakeer.
 *
 * Fehrist pehle se batati thi ke kis kisan ka kitna baqi hai. Magar jab
 * kisan phone par poochhta hai "ye baqi bana kaise?", to us jama shuda
 * adad ka koi jawab nahi hota tha. Ye safha wohi jawab hai: har bill
 * aur har adaigi apni qatar mein, aur har qatar ke saamne US WAQT ka
 * baqi.
 *
 * ADAD YAHAN DOBARA NAHI GINE JATE. Wohi qaida jo v_machinery_control
 * mein likha hai:
 *
 *   bill ki qatar   = machinery_bills.balance_payable
 *                     (advance aur diesel us ke andar pehle hi kat
 *                      chuke hote hain -- unhen alag qatar banana wohi
 *                      raqam do dafa ginna hota)
 *   adaigi ki qatar = machinery_payments jahan kind = 'final' AUR
 *                     verification_status = 'verified'
 *
 * Do jagah do hisaab banane ka anjaam ye hota hai ke kisi din fehrist
 * kuch aur kehti hai aur khata kuch aur -- aur phir kisi ko nahi pata
 * hota ke sach kaun sa hai.
 *
 * JO ADAIGI ABHI TASDEEQ NAHI HUI wo baqi mein se nahi kat-ti, magar
 * chhupai bhi nahi jati -- neeche apni jagah nazar aati hai. Usay ginti
 * mein daal dena kisan ko wo raahat de dena hai jo abhi sabit nahi hui;
 * usay bilkul na dikhana staff ko ye shak dena hai ke us ka indraj gum
 * ho gaya.
 */
export default async function FarmerMachineryKhataPage({ params }: { params: { farmerId: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: farmer } = await supabase
    .from("farmers")
    .select("id, full_name, farmer_code, phone_number, village")
    .eq("id", params.farmerId)
    .maybeSingle();
  if (!farmer) notFound();

  const { data: bookings } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status, crop_type")
    .eq("farmer_id", params.farmerId)
    .neq("status", "cancelled");

  const ids = (bookings ?? []).map((b) => b.id);
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));

  // Khate ki gadi ke liye khaton ki fehrist -- adaigi ab yahin darj
  // hoti hai, aur bank/company wale raaste par khata likhna lazmi hai.
  const { data: accountRows } = await supabase
    .from("finance_accounts")
    .select("id, name, account_type")
    .eq("is_active", true)
    .order("account_type");
  const accounts = (accountRows ?? []).map((a) => ({ id: a.id, name: a.name, account_type: a.account_type }));

  const [{ data: bills }, { data: payments }] = await Promise.all([
    ids.length
      ? supabase
          .from("machinery_bills")
          .select(
            "id, booking_id, bill_number, bill_date, gross_amount, discount_amount, advance_adjusted, previous_payment, diesel_deducted, balance_payable, actual_area"
          )
          .in("booking_id", ids)
          .is("cancelled_at", null)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase
          .from("machinery_payments")
          .select("id, booking_id, kind, amount, payment_date, method, reference, verification_status")
          .in("booking_id", ids)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const billRows = bills ?? [];
  const payRows = payments ?? [];

  // Tasdeeq shuda final adaigiyan -- yehi ginti mein aati hain.
  const counted = payRows.filter((p) => p.kind === "final" && p.verification_status === "verified");
  const pending = payRows.filter((p) => p.kind === "final" && p.verification_status !== "verified");

  type Entry = {
    date: string;
    kind: "bill" | "payment";
    title: string;
    sub: string | null;
    bookingId: string;
    debit: number;
    credit: number;
    balance: number;
  };

  const entries: Entry[] = [
    ...billRows.map((b) => {
      const bk = bookingById.get(b.booking_id as string);
      const bits: string[] = [];
      if (Number(b.gross_amount ?? 0) !== Number(b.balance_payable ?? 0)) {
        bits.push(`${t("mk_gross", lang)} Rs ${Number(b.gross_amount ?? 0).toLocaleString()}`);
        if (Number(b.discount_amount ?? 0) > 0) bits.push(`${t("mk_discount", lang)} −Rs ${Number(b.discount_amount).toLocaleString()}`);
        if (Number(b.advance_adjusted ?? 0) > 0) bits.push(`${t("mk_advance_adj", lang)} −Rs ${Number(b.advance_adjusted).toLocaleString()}`);
        if (Number(b.previous_payment ?? 0) > 0) bits.push(`${t("mk_prev_paid", lang)} −Rs ${Number(b.previous_payment).toLocaleString()}`);
        if (Number(b.diesel_deducted ?? 0) > 0) bits.push(`${t("mk_diesel_cut", lang)} −Rs ${Number(b.diesel_deducted).toLocaleString()}`);
      }
      return {
        date: b.bill_date as string,
        kind: "bill" as const,
        title: `${t("mk_bill", lang)} ${b.bill_number ?? ""}`,
        sub: [bk?.booking_number, b.actual_area ? `${b.actual_area} acre` : null, bits.join(" · ") || null]
          .filter(Boolean)
          .join(" · ") || null,
        bookingId: b.booking_id as string,
        debit: Number(b.balance_payable ?? 0),
        credit: 0,
        balance: 0,
      };
    }),
    ...counted.map((p) => {
      const bk = bookingById.get(p.booking_id as string);
      return {
        date: p.payment_date as string,
        kind: "payment" as const,
        title: t("mk_payment", lang),
        sub: [bk?.booking_number, p.method, p.reference].filter(Boolean).join(" · ") || null,
        bookingId: p.booking_id as string,
        debit: 0,
        credit: Number(p.amount ?? 0),
        balance: 0,
      };
    }),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let running = 0;
  for (const e of entries) {
    running += e.debit - e.credit;
    e.balance = running;
  }

  // Sar par wale adad WOHI qaide se bante hain jo fehrist istemal karti
  // hai: har booking alag, phir jor. Ek hi bara ghata karne se ek
  // booking ka zyada diya hua paisa doosri ka baqi kaat deta -- aur wo
  // do alag baatein hain.
  const perBooking = new Map<string, { bill: number; paid: number }>();
  for (const b of billRows) {
    const k = b.booking_id as string;
    const cur = perBooking.get(k) ?? { bill: 0, paid: 0 };
    cur.bill += Number(b.balance_payable ?? 0);
    perBooking.set(k, cur);
  }
  for (const p of counted) {
    const k = p.booking_id as string;
    const cur = perBooking.get(k) ?? { bill: 0, paid: 0 };
    cur.paid += Number(p.amount ?? 0);
    perBooking.set(k, cur);
  }
  let baqi = 0;
  let zyada = 0;
  for (const v of perBooking.values()) {
    baqi += Math.max(v.bill - v.paid, 0);
    zyada += Math.max(v.paid - v.bill, 0);
  }

  const outstanding = [...perBooking.entries()]
    .map(([bookingId, v]) => ({
      bookingId,
      bookingNumber: bookingById.get(bookingId)?.booking_number ?? "",
      due: Math.max(v.bill - v.paid, 0),
    }))
    .filter((o) => o.due > 0)
    .sort((a, b) => b.due - a.due);

  const shown = [...entries].reverse();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/admin/machinery-rental/list" className="text-sm text-surface-500 hover:underline">
        ← {t("mk_back", lang)}
      </Link>

      <h1 className="mt-2 font-display text-2xl font-semibold text-surface-900 dark:text-white">
        {farmer.full_name}
      </h1>
      <p className="text-sm text-surface-500">
        {[farmer.farmer_code, farmer.village, farmer.phone_number].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-surface-200 p-4 dark:border-surface-700">
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("mk_to_collect", lang)}</p>
          <p className={`font-display text-2xl font-semibold ${baqi > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
            Rs {baqi.toLocaleString()}
          </p>
        </div>
        {zyada > 0 && (
          <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">{t("mk_overpaid", lang)}</p>
            <p className="font-display text-2xl font-semibold text-amber-800 dark:text-amber-300">
              Rs {zyada.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("mk_overpaid_note", lang)}</p>
          </div>
        )}
      </div>

      {/* Jin bookings par abhi baqi hai -- aur adaigi WAHIN darj hoti
          hai, isi safhe par.
          Pehle yahan sirf booking ke safhe ka link tha. Wo ghalat tha:
          paisa lene wala banda khata dekh raha hota hai, aur usay wahan
          se kisi doosre safhe par bhejna ek aisa qadam hai jis ki koi
          wajah nahi.
          Khana wohi hai jo booking ke safhe par lagta hai (ek hi
          component, ek hi server action) -- do nakalein banate to kal
          ek jagah qaida badalta aur doosri purani reh jati, aur wo farq
          paise ka hota. */}
      {outstanding.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("mk_open_bookings", lang)}</p>
          {outstanding.map((o) => (
            <KhataPaymentRow
              key={o.bookingId}
              bookingId={o.bookingId}
              bookingNumber={o.bookingNumber}
              due={o.due}
              accounts={accounts}
              lang={lang}
            />
          ))}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-card border border-surface-200 dark:border-surface-800">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-surface-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-surface-500 dark:border-surface-800">
          <span>{t("mk_entries", lang)}</span>
          <span className="text-right">{t("mk_charged", lang)}</span>
          <span className="text-right">{t("mk_received", lang)}</span>
        </div>

        {shown.map((e, i) => (
          <div
            key={`${e.kind}-${i}`}
            className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-surface-100 px-3 py-2 text-sm last:border-0 dark:border-surface-800"
          >
            <div>
              <p className="text-xs text-surface-400">{new Date(e.date).toLocaleDateString()}</p>
              <Link
                href={`/admin/machinery-rental/booking/${e.bookingId}`}
                className="font-medium text-surface-800 hover:underline dark:text-surface-200"
              >
                {e.title}
              </Link>
              {e.sub && <p className="text-xs text-surface-500">{e.sub}</p>}
              <p className="mt-0.5 inline-block rounded bg-surface-100 px-1.5 py-0.5 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                {t("mk_balance_then", lang)}: Rs {e.balance.toLocaleString()}
              </p>
            </div>
            <span className="text-right font-medium text-red-600 dark:text-red-400">
              {e.debit > 0 ? e.debit.toLocaleString() : ""}
            </span>
            <span className="text-right font-medium text-green-700 dark:text-green-400">
              {e.credit > 0 ? e.credit.toLocaleString() : ""}
            </span>
          </div>
        ))}

        {shown.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-surface-400">{t("mk_empty", lang)}</p>
        )}
      </div>

      {/* Jo darj hai magar tasdeeq nahi hui. Ye baqi mein se nahi kat-ti
          -- magar chhupai bhi nahi jati, warna staff samajhta hai ke us
          ka indraj gum ho gaya. */}
      {pending.length > 0 && (
        <div className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {t("mk_pending_verify", lang)}
          </p>
          {pending.map((p) => (
            <div key={p.id} className="flex justify-between text-amber-800 dark:text-amber-300">
              <span>
                {new Date(p.payment_date as string).toLocaleDateString()}
                {p.method ? ` · ${p.method}` : ""}
              </span>
              <span className="font-medium">Rs {Number(p.amount ?? 0).toLocaleString()}</span>
            </div>
          ))}
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t("mk_pending_note", lang)}</p>
        </div>
      )}
    </div>
  );
}
