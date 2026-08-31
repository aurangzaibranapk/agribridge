import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Is kisan ka machinery ka poora hisaab -- ek jagah.
 *
 * Admin kisan par click karta hai to us ka pehla sawal ye hota hai:
 * "is ne kitni bookings karwayin, kitna kaam hua, aur is ke zimme kitna
 * hai?" Us ka jawab teen alag safhon par bikhra hua tha.
 *
 * Adad yahan dobara nahi ginte -- bill jo kehta hai wohi likha jata
 * hai. Do jagah do hisaab banane ka matlab hota kisi din do mukhtalif
 * adad.
 */
export async function FarmerMachineryHistory({ farmerId }: { farmerId: string }) {
  const supabase = createClient();

  const { data: bookings } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, booking_date, preferred_date, status, crop_type, harvest_area, final_rate")
    .eq("farmer_id", farmerId)
    .order("booking_date", { ascending: false });

  const rows = bookings ?? [];
  if (rows.length === 0) return null;

  const ids = rows.map((b) => b.id);
  const [{ data: bills }, { data: pays }] = await Promise.all([
    supabase.from("machinery_bills").select("booking_id, bill_number, gross_amount, discount_amount, advance_adjusted, balance_payable").in("booking_id", ids).is("cancelled_at", null),
    supabase.from("machinery_payments").select("booking_id, kind, amount, verification_status").in("booking_id", ids),
  ]);

  const cards = rows.map((b) => {
    const bill = (bills ?? []).find((x) => x.booking_id === b.id) ?? null;
    const mine = (pays ?? []).filter((p) => p.booking_id === b.id && p.verification_status === "verified");
    const paid = mine.filter((p) => p.kind === "final").reduce((s, p) => s + Number(p.amount), 0);
    return {
      ...b,
      billNumber: bill?.bill_number ?? null,
      gross: bill ? Number(bill.gross_amount) : null,
      balance: bill ? Math.max(Number(bill.balance_payable) - paid, 0) : null,
    };
  });

  const done = cards.filter((c) => c.status === "closed").length;
  const open = cards.filter((c) => !["closed", "cancelled"].includes(c.status)).length;
  const outstanding = cards.reduce((s, c) => s + (c.balance ?? 0), 0);

  return (
    <div className="mb-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Machinery</h2>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Kul bookings" value={String(cards.length)} />
        <Stat label="Mukammal" value={String(done)} />
        <Stat label="Chal rahi" value={String(open)} />
        <Stat label="Kisan ke zimme" value={`Rs ${outstanding.toLocaleString()}`} tone={outstanding > 0 ? "red" : "green"} />
      </div>

      <div className="space-y-2">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/admin/machinery-rental/booking/${c.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-surface-100 p-3 transition hover:border-brand-400 dark:border-surface-800"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs text-surface-400">{c.booking_number}</p>
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                {c.crop_type ?? "-"} · {Number(c.harvest_area ?? 0)} acre
                {c.final_rate ? ` · Rs ${Number(c.final_rate).toLocaleString()}/acre` : ""}
              </p>
              {/* Do tareekhein alag: booking kab hui, kattai kab honi
                  thi. Ek hi jagah mila dena in ko aik samajh lene ki
                  wajah banta hai. */}
              <p className="text-xs text-surface-400">
                booking {new Date(c.booking_date).toLocaleDateString()}
                {c.preferred_date ? ` · kattai ${new Date(c.preferred_date).toLocaleDateString()}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs capitalize text-surface-500">{c.status.replace(/_/g, " ")}</p>
              {c.balance !== null && (
                <p className={`text-sm font-medium ${c.balance > 0 ? "text-red-600" : "text-brand-700"}`}>
                  Rs {c.balance.toLocaleString()}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <div className="rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800">
      <p className="text-xs text-surface-500">{label}</p>
      <p
        className={`font-display text-lg font-semibold ${
          tone === "red" ? "text-red-600" : tone === "green" ? "text-brand-700" : "text-surface-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
