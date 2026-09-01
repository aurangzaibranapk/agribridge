import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LifterPaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";

/**
 * Ek uthane wale ka khata -- lakeer ba lakeer.
 *
 * TEEN SABAB ALAG ALAG DIKHTE HAIN, aur jaan boojh kar. "Rs 63,125 baqi"
 * ek adad ho to us se ye kabhi nahi poochha ja sakta ke ye kattai ka hai,
 * kisan ke purane udhaar ka, ya hamare commission ka -- aur us bande se
 * baat karte waqt yehi teen alag alag cheezein hoti hain.
 *
 * ADAD YAHAN DOBARA NAHI GINE JATE. Wohi qaida jo v_crop_lifter_balances
 * mein likha hai. Do jagah do hisaab banane ka anjaam ye hota hai ke
 * kisi din fehrist kuch aur kehti hai aur khata kuch aur -- aur phir
 * kisi ko nahi pata hota ke sach kaun sa hai.
 */
export default async function LifterKhataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: lifter } = await supabase
    .from("crop_lifters")
    .select("id, name, phone, village, commission_rate, is_active, notes")
    .eq("id", id)
    .maybeSingle();
  if (!lifter) notFound();

  const [{ data: bal }, { data: lifts }, { data: payments }, { data: accounts }] = await Promise.all([
    supabase.from("v_crop_lifter_balances").select("*").eq("lifter_id", id).maybeSingle(),
    supabase
      .from("booking_crop_lifts")
      .select(
        "id, booking_id, status, crop_value, commission_rate, commission_amount, harvest_charge_moved, farmer_old_due_moved, farmer_old_due_reliable, farmer_payable, lifter_payable, lifted_at, created_at, machinery_bookings(booking_number, farmers(full_name))"
      )
      .eq("lifter_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("crop_lifter_payments")
      .select("id, amount, payment_date, method, reference, notes")
      .eq("lifter_id", id)
      .order("payment_date", { ascending: false }),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
  ]);

  const kattai = Number(bal?.kattai_ka_zimma ?? 0);
  const purana = Number(bal?.purana_baqi_ka_zimma ?? 0);
  const commission = Number(bal?.commission_bana ?? 0);
  const diya = Number(bal?.diya ?? 0);
  const baqi = Number(bal?.baqi ?? 0);

  const rows = (lifts ?? []).map((l: any) => {
    const b = Array.isArray(l.machinery_bookings) ? l.machinery_bookings[0] : l.machinery_bookings;
    const f = b ? (Array.isArray(b.farmers) ? b.farmers[0] : b.farmers) : null;
    return {
      id: l.id,
      bookingId: l.booking_id,
      bookingNumber: b?.booking_number ?? "—",
      farmerName: f?.full_name ?? "—",
      status: l.status as string,
      cropValue: l.crop_value === null ? null : Number(l.crop_value),
      rate: Number(l.commission_rate),
      commission: l.commission_amount === null ? null : Number(l.commission_amount),
      kattai: l.harvest_charge_moved === null ? null : Number(l.harvest_charge_moved),
      purana: l.farmer_old_due_moved === null ? null : Number(l.farmer_old_due_moved),
      reliable: l.farmer_old_due_reliable as boolean | null,
      farmerPayable: l.farmer_payable === null ? null : Number(l.farmer_payable),
      lifterPayable: l.lifter_payable === null ? null : Number(l.lifter_payable),
      date: (l.lifted_at ?? l.created_at) as string,
    };
  });

  return (
    <div>
      <PageHeader
        title={lifter.name}
        description={[lifter.phone, lifter.village, `Commission ${Number(lifter.commission_rate)}%`]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="mb-2">
        <Link href="/admin/machinery-rental/lifters" className="text-sm text-brand-600 hover:underline">
          ← Sab uthane wale
        </Link>
      </div>

      {/* Teen sabab, teen khane -- aur chautha un ka jor. */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">Kattai ka zimma</p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums">Rs {kattai.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">Kisan ka purana baqi</p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums">Rs {purana.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20">
          <p className="text-xs uppercase tracking-wide text-green-700">Hamara commission</p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums text-green-700">
            Rs {commission.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">Diya</p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums">Rs {diya.toLocaleString()}</p>
        </Card>
        <Card
          className={
            baqi > 0
              ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
              : "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
          }
        >
          <p className={`text-xs uppercase tracking-wide ${baqi > 0 ? "text-red-700" : "text-green-700"}`}>
            {baqi > 0 ? "In se lena" : "Hisaab saaf"}
          </p>
          <p
            className={`mt-1 font-display text-lg font-semibold tabular-nums ${
              baqi > 0 ? "text-red-700" : "text-green-700"
            }`}
          >
            Rs {baqi.toLocaleString()}
          </p>
        </Card>
      </div>

      {baqi > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Adaigi darj karein
          </h2>
          <LifterPaymentForm lifterId={id} remaining={baqi} accounts={accounts ?? []} />
        </Card>
      )}

      {/* Har bill apni qatar mein -- aur us ke andar wo teen adad jin se
          wo bana. Kisi bhi adad par ungli rakh kar poochha ja sake ke ye
          bana kaise. */}
      <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
        Uthai hui fasal
      </h2>
      <div className="mb-6 space-y-2">
        {rows.length === 0 && (
          <p className="rounded-card border border-surface-200 px-3 py-6 text-center text-sm text-surface-400 dark:border-surface-800">
            Abhi is ke naam par koi booking nahi.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="rounded-card border border-surface-200 p-3 dark:border-surface-700">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/admin/machinery-rental/booking/${r.bookingId}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {r.bookingNumber}
                </Link>
                <p className="text-xs text-surface-500">
                  {r.farmerName} · {new Date(r.date).toLocaleDateString()}
                </p>
              </div>
              {r.status === "lifted" ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950/40 dark:text-green-300">
                  Utha chuki
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Abhi uthani hai
                </span>
              )}
            </div>

            {r.status === "lifted" && (
              <div className="mt-3 space-y-1 border-t border-surface-100 pt-2 text-sm dark:border-surface-800">
                <Line label="Fasal ki qeemat" value={r.cropValue} strong />
                <Line label="Kattai ka bill" value={r.kattai} minus />
                <Line label="Kisan ka purana baqi" value={r.purana} minus />
                <Line label="Kisan ko diya jana tha" value={r.farmerPayable} strong />
                <div className="my-1 border-t border-surface-100 dark:border-surface-800" />
                <Line label={`Hamara commission (${r.rate}%)`} value={r.commission} />
                <Line label="Hamein dena" value={r.lifterPayable} strong />
                {/* Bill banate waqt ledger adhoora tha ya nahi -- ye
                    baat qatar par likhi rehti hai, warna baad mein koi
                    nahi bata sakta ke us din adad par bharosa tha ya
                    nahi. */}
                {r.reliable === false && (
                  <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    Ye bill us waqt bana jab kuch raqam ledger tak nahi pahunchi thi — purana baqi adhoora ho sakta hai.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">Adaigi</h2>
      <div className="overflow-hidden rounded-card border border-surface-200 dark:border-surface-800">
        {(payments ?? []).length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-surface-400">Abhi koi adaigi darj nahi.</p>
        )}
        {(payments ?? []).map((p: any) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 px-3 py-2 text-sm last:border-0 dark:border-surface-800"
          >
            <div>
              <p className="text-surface-800 dark:text-surface-200">
                {new Date(p.payment_date).toLocaleDateString()} · {p.method}
              </p>
              {(p.reference || p.notes) && (
                <p className="text-xs text-surface-400">{[p.reference, p.notes].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <p className="font-medium tabular-nums text-green-700 dark:text-green-400">
              Rs {Number(p.amount).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Ek lakeer.
 *
 * KHALI aur SIFAR ka farq yahan bhi rakha gaya hai: jis adad ka indraj
 * hi nahi hua us ke saamne "—" aata hai, "Rs 0" nahi. Rs 0 kehta hai
 * "dekh liya, kuch nahi tha".
 */
function Line({
  label,
  value,
  minus = false,
  strong = false,
}: {
  label: string;
  value: number | null;
  minus?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={strong ? "font-medium text-surface-800 dark:text-surface-200" : "text-surface-600 dark:text-surface-400"}>
        {minus ? "− " : ""}
        {label}
      </span>
      <span
        className={`tabular-nums ${
          strong ? "font-medium text-surface-900 dark:text-surface-100" : "text-surface-700 dark:text-surface-300"
        }`}
      >
        {value === null ? "—" : `Rs ${value.toLocaleString()}`}
      </span>
    </div>
  );
}
