import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PnlClient, type PnlRow, type Period, type Basis } from "./pnl-client";

export const dynamic = "force-dynamic";

/**
 * Machinery ka apna P&L.
 *
 * Poore karobar ka P&L pehle se hai, magar us se ye sawal nahi milta:
 * "machinery se hum ne waqai kitna kamaya?"
 *
 * Do jaal is safhe par hain, aur dono ne kabhi na kabhi ghalat jawab
 * diya hai:
 *
 *   1. ART ka diya hua diesel jo VENDOR se wapas aata hai, wo kharcha
 *      NAHI hai. Usay kharche mein ginna munafa jhooti tarah kam kar
 *      ke dikhata hai -- aur usi adad par machine rakhne ya na rakhne
 *      ka faisla hota hai.
 *
 *   2. "gross billing - vendor payable" ko ART ka margin samajhna.
 *      Vendor ke hisse mein se KISAN ka diesel pehle hi kat chuka hota
 *      hai, is liye wo formula kisan ke diesel ko ART ki aamdani bana
 *      deta hai -- wo paisa jo ART ke paas kabhi aaya hi nahi. Sahi
 *      adad bill ka apna commission_amount hai, jo ledger ke 4030
 *      Machinery Income se lafz-ba-lafz milta hai.
 *
 * Hisaab yahan banta NAHI. Poora hisaab ek hi jagah hai --
 * v_machinery_pnl_booking -- aur ye safha usi ki qatarein le kar arse
 * ke hisaab se jorta hai. Machine, vendor, fasal aur maheene wale
 * gosháre bhi unhi qataron se bante hain, alag query se nahi, warna
 * chaar adad ek doosre se hat jate.
 */

/** Season ki tareef: Kharif 1 May - 31 October, Rabi 1 November - 30 April. */
function seasonRange(today: Date): { from: string; to: string; label: string } {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  if (m >= 5 && m <= 10) {
    return { from: `${y}-05-01`, to: `${y}-10-31`, label: `Kharif ${y}` };
  }
  // November aur December Rabi ka shuru; January se April usi Rabi ka aakhir.
  const start = m >= 11 ? y : y - 1;
  return { from: `${start}-11-01`, to: `${start + 1}-04-30`, label: `Rabi ${start}–${start + 1}` };
}

function rangeFor(period: Period, from: string | null, to: string | null) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (period) {
    case "today":
      return { from: iso(today), to: iso(today), label: null };
    case "7d": {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { from: iso(d), to: iso(today), label: null };
    }
    case "month":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today), label: null };
    case "season": {
      const s = seasonRange(today);
      return { from: s.from, to: s.to, label: s.label };
    }
    case "custom":
      return { from: from ?? iso(today), to: to ?? iso(today), label: null };
    default:
      return { from: null, to: null, label: null };
  }
}

export default async function MachineryPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; basis?: string; from?: string; to?: string }>;
}) {
  const lang = getLanguageFromCookies("rm");
  const sp = await searchParams;
  const supabase = createClient();

  const period = (["today", "7d", "month", "season", "custom", "all"].includes(sp.period ?? "")
    ? sp.period
    : "all") as Period;
  // Hisaab ki tareekh BILL ki tareekh hai (malik ka faisla). Kaam wali
  // tareekh sirf machine ki kaarkardagi dekhne ke liye hai.
  const basis: Basis = sp.basis === "work" ? "work" : "bill";
  const range = rangeFor(period, sp.from ?? null, sp.to ?? null);
  const dateCol = basis === "work" ? "kaam_ki_tareekh" : "bill_date";

  let q = supabase.from("v_machinery_pnl_booking").select("*");
  if (range.from) q = q.gte(dateCol, range.from);
  if (range.to) q = q.lte(dateCol, range.to);
  const { data } = await q.order(dateCol, { ascending: false, nullsFirst: false });

  const n = (v: unknown) => Number(v ?? 0);
  const rows: PnlRow[] = (data ?? []).map((r) => ({
    bookingId: r.booking_id as string,
    bookingNumber: (r.booking_number as string) ?? "-",
    billNumber: (r.bill_number as string | null) ?? null,
    billDate: (r.bill_date as string | null) ?? null,
    workDate: (r.kaam_ki_tareekh as string | null) ?? null,
    bookingDate: (r.booking_date as string | null) ?? null,
    cropType: (r.crop_type as string | null) ?? null,
    vendorId: (r.vendor_id as string | null) ?? null,
    vendorName: (r.vendor_name as string | null) ?? null,
    machineId: (r.machine_id as string | null) ?? null,
    machineCode: (r.machine_code as string | null) ?? null,
    machineType: (r.machine_type as string | null) ?? null,
    machineOwner: (r.machine_owner as string) ?? "vendor",
    acre: n(r.acre),
    gross: n(r.gross_billing),
    vendorShare: n(r.vendor_ka_hissa),
    margin: n(r.hamari_aamdani),
    ownDiesel: n(r.diesel_hamara_kharcha),
    recoverableDiesel: n(r.diesel_wapas_aane_wala),
    farmerDiesel: n(r.kisan_ka_diesel),
    vendorDiesel: n(r.diesel_vendor_ne_diya),
    received: n(r.wasooli),
    profit: n(r.munafa),
  }));

  return (
    <PnlClient
      rows={rows}
      lang={lang}
      period={period}
      basis={basis}
      from={sp.from ?? null}
      to={sp.to ?? null}
      seasonLabel={range.label}
    />
  );
}
