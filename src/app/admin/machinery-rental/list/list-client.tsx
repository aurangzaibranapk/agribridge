"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { emailMachineryBookingsList, type ActionState } from "@/actions/machinery-rental";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { PinLocation } from "./pin-location";
import { Printer, Download, MessageCircle, Mail, ArrowLeft, X, Search } from "lucide-react";

const initialState: ActionState = {};

interface Row {
  id: string;
  bookingNumber: string;
  bookingDate: string;
  harvestDate: string | null;
  farmerId: string | null;
  farmerName: string;
  farmerCode: string;
  farmerPhone: string | null;
  village: string | null;
  cropType: string | null;
  machineType: string | null;
  machineModel: string | null;
  vendorId: string | null;
  vendorName: string | null;
  area: number;
  rate: number | null;
  billNumber: string | null;
  gross: number | null;
  received: number;
  advance: number;
  outstanding: number;
  overpaid: number;
  vendorOutstanding: number;
  commission: number;
  workState: string;
  payState: string;
  nextAction: string;
  overdue: boolean;
  promiseDate: string | null;
  lastPayment: string | null;
  lat: number | null;
  lng: number | null;
}

interface FarmerRow {
  farmerId: string;
  farmerName: string;
  farmerCode: string;
  village: string | null;
  bookings: number;
  done: number;
  totalBill: number;
  received: number;
  outstanding: number;
  lastPayment: string | null;
}

/**
 * Agla kaam -- ye poore safhe ki jaan hai.
 *
 * Staff ko khud nahi sochna chahiye ke booking kis halat mein hai. Ye
 * jumla system data dekh kar khud nikalta hai (migration 160), aur
 * yahan sirf us ka rang aur naam tay hota hai.
 *
 * Rang jaan boojh kar mehdood hain: laal sirf paise ke liye, kyunke
 * agar har cheez laal ho to laal ka matlab khatam ho jata hai.
 */
const ACTION: Record<string, { key: TranslationKey; tone: string; dot: string }> = {
  rate_final_karein: { key: "mca_rate", tone: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  machine_bhejein: { key: "mca_machine", tone: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  kaam_darj_karein: { key: "mca_work", tone: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  bill_banayein: { key: "mca_bill", tone: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  paisa_lena: { key: "mca_money", tone: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  wapas_karein: { key: "mca_refund", tone: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  vendor_ko_dena: { key: "mca_vendor", tone: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  mukammal: { key: "mca_done", tone: "text-brand-700 dark:text-brand-300", dot: "bg-brand-500" },
  cancelled: { key: "mca_cancelled", tone: "text-surface-400", dot: "bg-surface-300" },
};

// Card ki tarteeb wohi jo silsile ki hai -- fehrist us tarteeb se
// parhi jati hai jis se kaam hota hai.
const CARDS: Array<{ id: string; label: TranslationKey; match: (r: Row) => boolean; tone: string }> = [
  { id: "all", label: "mc_all", match: () => true, tone: "brand" },
  { id: "rate_final_karein", label: "mca_rate", match: (r) => r.nextAction === "rate_final_karein", tone: "amber" },
  { id: "machine_bhejein", label: "mca_machine", match: (r) => r.nextAction === "machine_bhejein", tone: "blue" },
  { id: "kaam_darj_karein", label: "mca_work", match: (r) => r.nextAction === "kaam_darj_karein", tone: "purple" },
  { id: "bill_banayein", label: "mca_bill", match: (r) => r.nextAction === "bill_banayein", tone: "amber" },
  { id: "paisa_lena", label: "mca_money", match: (r) => r.nextAction === "paisa_lena", tone: "red" },
  { id: "mukammal", label: "mca_done", match: (r) => r.nextAction === "mukammal", tone: "green" },
];

const TONES: Record<string, string> = {
  brand: "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30",
  amber: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30",
  blue: "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30",
  purple: "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30",
  red: "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30",
  green: "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30",
};

export function MachineryListClient({ rows, farmers }: { rows: Row[]; farmers: FarmerRow[] }) {
  const lang = useLang();
  const [showEmail, setShowEmail] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [machine, setMachine] = useState("");
  const [crop, setCrop] = useState("");
  const [village, setVillage] = useState("");

  const machines = useMemo(
    () => [...new Set(rows.map((r) => r.machineType).filter(Boolean))] as string[],
    [rows]
  );
  const crops = useMemo(() => [...new Set(rows.map((r) => r.cropType).filter(Boolean))] as string[], [rows]);
  const villages = useMemo(() => [...new Set(rows.map((r) => r.village).filter(Boolean))] as string[], [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const card = CARDS.find((c) => c.id === filter);
      if (card && !card.match(r)) return false;
      if (machine && r.machineType !== machine) return false;
      if (crop && r.cropType !== crop) return false;
      if (village && r.village !== village) return false;
      if (!q) return true;
      return [r.bookingNumber, r.farmerName, r.farmerCode, r.farmerPhone, r.village]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, filter, query, machine, crop, village]);

  // Jor hamesha us par jo SAAMNE hai. Poori fehrist ka jor dikhana aur
  // chhaanti hui fehrist dikhana ek sath uljhan paida karta hai.
  const totals = shown.reduce(
    (acc, r) => ({
      bill: acc.bill + (r.gross ?? 0),
      received: acc.received + r.received,
      outstanding: acc.outstanding + r.outstanding,
      vendor: acc.vendor + Math.max(r.vendorOutstanding, 0),
      commission: acc.commission + r.commission,
    }),
    { bill: 0, received: 0, outstanding: 0, vendor: 0, commission: 0 }
  );

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    window.open("/api/machinery/bookings-list-pdf", "_blank");
  }
  function handleWhatsApp() {
    const lines = shown
      .slice(0, 30)
      .map((r) => `${r.bookingNumber} ${r.farmerName} — ${r.area} acre — baqi Rs ${r.outstanding.toLocaleString()}`)
      .join("\n");
    const text = `Al Rana Traders — Machinery\n${t(CARDS.find((c) => c.id === filter)?.label ?? "mc_all", lang)}: ${
      shown.length
    }\nBaqi kul: Rs ${totals.outstanding.toLocaleString()}\n\n${lines}${shown.length > 30 ? "\n..." : ""}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/admin/machinery-rental" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> {t("mc_back", lang)}
        </Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" /> {t("mc_print", lang)}
          </button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200">
            <Download className="h-3.5 w-3.5" /> {t("mc_download", lang)}
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" />{t("at_whatsapp", lang)}</button>
          <button onClick={() => setShowEmail(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Mail className="h-3.5 w-3.5" />{t("at_email", lang)}</button>
        </div>
      </div>

      <h1 className="mb-3 font-display text-xl font-semibold text-surface-900 dark:text-white">
        {t("mc_control_title", lang)}
      </h1>

      {/* Har card ek chhaanti bhi hai. Adad kisi ke lagane se nahi
          bante -- wo records se khud nikalte hain. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 print:hidden">
        {CARDS.map((c) => {
          const count = rows.filter(c.match).length;
          const money =
            c.id === "paisa_lena"
              ? rows.filter(c.match).reduce((s, r) => s + r.outstanding, 0)
              : null;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`rounded-lg border p-2 text-left transition ${
                filter === c.id ? TONES[c.tone] : "border-surface-200 text-surface-500 hover:border-surface-300 dark:border-surface-700"
              }`}
            >
              <p className="font-display text-lg font-semibold">{count}</p>
              <p className="text-xs">{t(c.label, lang)}</p>
              {money !== null && money > 0 && (
                <p className="text-xs font-medium">Rs {money.toLocaleString()}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Chhaanti. Aath bookings par ye zaroori nahi lagti; aath hazar
          par ye poore safhe ko kaam ka banati hai. */}
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-surface-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("mc_search_hint", lang)}
            className="w-full rounded-lg border border-surface-200 py-2 pl-8 pr-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          />
        </div>
        <Picker value={machine} onChange={setMachine} options={machines} label={t("mc_machine", lang)} />
        <Picker value={crop} onChange={setCrop} options={crops} label={t("mc_crop", lang)} />
        <Picker value={village} onChange={setVillage} options={villages} label={t("mc_village", lang)} />
      </div>

      <div className="mb-4 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900 print:border-0 print:shadow-none">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 className="font-display text-base font-bold text-surface-900 dark:text-white">{t("at_alrana_machinery", lang)}</h2>
          <p className="text-xs text-surface-400">
            {t(CARDS.find((c) => c.id === filter)?.label ?? "mc_all", lang)} · {shown.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-surface-200 text-left dark:border-surface-800">
                <Th>{t("mc_booking_no", lang)}</Th>
                <Th>{t("mc_farmer", lang)}</Th>
                <Th>{t("mc_machine", lang)} / {t("mc_crop", lang)}</Th>
                <Th right>{t("mc_area", lang)}</Th>
                <Th>{t("mq_harvest_on", lang)}</Th>
                <Th right>{t("mc_bill_label", lang)}</Th>
                <Th right>{t("mc_received_so_far", lang)}</Th>
                <Th right>{t("mc_outstanding", lang)}</Th>
                <Th>{t("ml_location", lang)}</Th>
                <Th>{t("mc_next_action", lang)}</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const action = ACTION[r.nextAction] ?? ACTION.mukammal;
                return (
                  <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2">
                      <Link href={`/admin/machinery-rental/booking/${r.id}`} className="font-mono text-brand-600 hover:underline">
                        {r.bookingNumber}
                      </Link>
                      <p className="text-surface-400">{new Date(r.bookingDate).toLocaleDateString()}</p>
                    </td>
                    <td className="px-3 py-2">
                      {r.farmerId ? (
                        <Link href={`/admin/farmers/${r.farmerId}`} className="font-medium text-surface-800 hover:underline dark:text-surface-200">
                          {r.farmerName}
                        </Link>
                      ) : (
                        <span className="font-medium text-surface-800 dark:text-surface-200">{r.farmerName}</span>
                      )}
                      <p className="text-surface-400">{r.farmerCode || r.village || ""}</p>
                    </td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                      {r.machineType ?? "—"}
                      {r.cropType ? ` / ${r.cropType}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{r.area} Ac</td>
                    <td className="px-3 py-2">
                      {r.harvestDate ? (
                        <span className={r.overdue ? "font-medium text-red-600 dark:text-red-400" : "text-surface-600 dark:text-surface-400"}>
                          {new Date(r.harvestDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-surface-800 dark:text-surface-200">
                      {r.gross === null ? <span className="text-surface-400">—</span> : `Rs ${r.gross.toLocaleString()}`}
                    </td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                      {r.received > 0 ? `Rs ${r.received.toLocaleString()}` : r.advance > 0 ? `Rs ${r.advance.toLocaleString()} adv` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {/* Zyada di hui raqam bhi laal hai, magar us ka
                          naam alag hai: wo lena nahi, DENA hai. Dono
                          ko ek hi khane mein ek hi rang dena wo ghalti
                          hai jis se koi kisan se wo raqam maang leta
                          hai jo hum us ki den dar hain. */}
                      {r.outstanding > 0 ? (
                        <span className="text-red-600 dark:text-red-400">Rs {r.outstanding.toLocaleString()}</span>
                      ) : r.overpaid > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          Rs {r.overpaid.toLocaleString()}
                          <span className="block text-[10px] font-normal text-surface-400">{t("mc_refund_due", lang)}</span>
                        </span>
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>
                    {/* Jagah. Pin lagi ho to seedha naqshe par le jati
                        hai; na lagi ho to wahin se lag sakti hai --
                        kyunke jagah us waqt maloom hoti hai jab banda
                        khet par khara ho, aur tab tak yehi fehrist
                        saamne hoti hai. */}
                    <td className="px-3 py-2">
                      {r.lat != null && r.lng != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-700 underline dark:text-brand-300"
                        >
                          {t("ml_pinned", lang)}
                        </a>
                      ) : (
                        <PinLocation bookingId={r.id} />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/machinery-rental/booking/${r.id}`} className={`flex items-center gap-1.5 font-medium hover:underline ${action.tone}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${action.dot}`} />
                        {r.nextAction === "paisa_lena"
                          ? `Rs ${r.outstanding.toLocaleString()} ${t("mca_money_suffix", lang)}`
                          : r.nextAction === "wapas_karein"
                            ? `Rs ${r.overpaid.toLocaleString()} ${t("mca_refund", lang)}`
                            : t(action.key, lang)}
                      </Link>
                      {r.promiseDate && r.nextAction === "paisa_lena" && (
                        <p className="text-surface-400">
                          {t("mc_promise_recorded", lang)}: {new Date(r.promiseDate).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-surface-400">{t("mc_no_bookings", lang)}</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-300 font-semibold dark:border-surface-700">
                <td className="px-3 py-2" colSpan={5}>{t("mc_total", lang)}</td>
                <td className="px-3 py-2 text-right">Rs {totals.bill.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">Rs {totals.received.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">Rs {totals.outstanding.toLocaleString()}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Hamara apna hisaab -- kisan ka poora paisa hamari aamdani
          nahi. Commission hamara, baqi vendor ka. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Total label={t("mc_our_commission", lang)} value={totals.commission} tone="green" />
        <Total label={t("mc_received_so_far", lang)} value={totals.received} />
        <Total label={t("mc_outstanding", lang)} value={totals.outstanding} tone="red" />
        <Total label={t("mc_vendor_payable", lang)} value={totals.vendor} tone="amber" />
      </div>

      <FarmerStatement farmers={farmers} />

      <VendorStatement rows={rows} />

      {showEmail && <EmailModal onClose={() => setShowEmail(false)} />}
    </div>
  );
}

/**
 * Vendor ka khata -- ART ke paas kis ka kitna para hai.
 *
 * Bill bante hi kisan ka poora paisa hamara nahi ho jata: commission
 * hamara, baqi vendor ka. Jab tak wo diya na jaye, wo raqam hamare
 * paas AMANAT hai. Amanat ka hisaab dikhna chahiye, warna wo aahista
 * aahista "hamara paisa" lagne lagti hai.
 *
 * Adad wohi qatarein hain jo upar hain -- dobara nahi ginte.
 */
function VendorStatement({ rows }: { rows: Row[] }) {
  const lang = useLang();

  const vendors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; bookings: number; baqi: number }>();
    for (const r of rows) {
      if (!r.vendorId || r.nextAction === "cancelled") continue;
      const v = map.get(r.vendorId) ?? { id: r.vendorId, name: r.vendorName ?? "-", bookings: 0, baqi: 0 };
      v.bookings += 1;
      v.baqi += r.vendorOutstanding > 0 ? r.vendorOutstanding : 0;
      map.set(r.vendorId, v);
    }
    return [...map.values()].filter((v) => v.baqi > 0).sort((a, b) => b.baqi - a.baqi);
  }, [rows]);

  if (vendors.length === 0) return null;

  const kul = vendors.reduce((a, v) => a + v.baqi, 0);

  return (
    <div className="mt-4 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
          {t("mc_vendor_statement", lang)}
        </h2>
        <p className="text-xs text-surface-500">{t("mc_vendor_statement_hint", lang)}</p>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {vendors.map((v) => (
            <tr key={v.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
              <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{v.name}</td>
              <td className="px-3 py-2 text-right text-surface-500">
                {v.bookings} {t("mc_bookings", lang)}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-amber-700 dark:text-amber-300">
                Rs {v.baqi.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-surface-200 bg-surface-50 font-semibold dark:border-surface-700 dark:bg-surface-800/50">
            <td className="px-3 py-2 text-surface-700 dark:text-surface-300" colSpan={2}>
              {t("mc_total", lang)}
            </td>
            <td className="px-3 py-2 text-right text-amber-700 dark:text-amber-300">Rs {kul.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Kisan ka khata -- sab bookings ka jor.
 *
 * "Is kisan se kul kitna lena hai?" Ek kisan ki teen bookings hon to ye
 * sawal teen safhe khol kar joRne se hi milta tha.
 */
function FarmerStatement({ farmers }: { farmers: FarmerRow[] }) {
  const lang = useLang();
  const [onlyDue, setOnlyDue] = useState(false);
  const shown = onlyDue ? farmers.filter((f) => f.outstanding > 0) : farmers;

  const totals = shown.reduce(
    (acc, f) => ({
      bookings: acc.bookings + f.bookings,
      bill: acc.bill + f.totalBill,
      received: acc.received + f.received,
      outstanding: acc.outstanding + f.outstanding,
    }),
    { bookings: 0, bill: 0, received: 0, outstanding: 0 }
  );

  return (
    <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {t("mc_farmer_statement", lang)}
          </h2>
          <p className="text-xs text-surface-500">{t("mc_farmer_statement_hint", lang)}</p>
        </div>
        <button
          onClick={() => setOnlyDue((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            onlyDue ? "border-red-500 bg-red-50 text-red-700" : "border-surface-200 text-surface-500 dark:border-surface-700"
          }`}
        >
          {t("mc_only_due", lang)}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-xs">
          <thead>
            <tr className="border-b border-surface-200 text-left dark:border-surface-800">
              <Th>{t("mc_farmer", lang)}</Th>
              <Th right>{t("mc_bookings", lang)}</Th>
              <Th right>{t("mc_bill_label", lang)}</Th>
              <Th right>{t("mc_received_so_far", lang)}</Th>
              <Th right>{t("mc_outstanding", lang)}</Th>
              <Th>{t("mc_last_payment", lang)}</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.farmerId} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2">
                  {/* Naam par click karne se ab us kisan ka khata khulta
                      hai -- lakeer ba lakeer. Pehle profile khulti thi,
                      jahan "kitna baqi" to likha tha magar ye nahi ke
                      wo baqi bana kaise. */}
                  <Link href={`/admin/machinery-rental/khata/${f.farmerId}`} className="font-medium text-surface-800 hover:underline dark:text-surface-200">
                    {f.farmerName}
                  </Link>
                  <p className="text-surface-400">
                    {f.farmerCode || f.village || ""}
                    {" · "}
                    <Link href={`/admin/farmers/${f.farmerId}`} className="hover:underline">
                      {t("profile", lang)}
                    </Link>
                  </p>
                </td>
                <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                  {f.bookings}
                  {f.done > 0 && <span className="text-surface-400"> ({f.done} ✓)</span>}
                </td>
                <td className="px-3 py-2 text-right text-surface-800 dark:text-surface-200">Rs {f.totalBill.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {f.received.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {f.outstanding > 0 ? (
                    <span className="text-red-600 dark:text-red-400">Rs {f.outstanding.toLocaleString()}</span>
                  ) : (
                    <span className="text-brand-700 dark:text-brand-300">Rs 0</span>
                  )}
                </td>
                <td className="px-3 py-2 text-surface-500">
                  {f.lastPayment ? new Date(f.lastPayment).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-surface-400">{t("mc_no_bookings", lang)}</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-surface-300 font-semibold dark:border-surface-700">
              <td className="px-3 py-2">{t("mc_total", lang)}</td>
              <td className="px-3 py-2 text-right">{totals.bookings}</td>
              <td className="px-3 py-2 text-right">Rs {totals.bill.toLocaleString()}</td>
              <td className="px-3 py-2 text-right">Rs {totals.received.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">Rs {totals.outstanding.toLocaleString()}</td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 font-medium text-surface-500 ${right ? "text-right" : ""}`}>{children}</th>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone?: "red" | "green" | "amber" }) {
  const color =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "green"
      ? "text-brand-700 dark:text-brand-300"
      : tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : "text-surface-900 dark:text-white";
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="text-xs text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${color}`}>Rs {value.toLocaleString()}</p>
    </div>
  );
}

function Picker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function EmailModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(emailMachineryBookingsList, initialState);
  if (state.success) setTimeout(onClose, 1200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("mc_send_by_email", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("mc_email_sent", lang)}</p>}
        <form action={formAction} className="space-y-2">
          <input type="email" name="to_email" required placeholder={t("mc_email_address", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Bhejein"}</button>;
}
