"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { RefreshCw, MapPin, CalendarClock, AlertTriangle } from "lucide-react";

interface LiveCard {
  id: string;
  booking_number: string;
  farmer_name: string;
  farmer_code: string | null;
  farmer_phone: string | null;
  village: string | null;
  crop_type: string | null;
  area: number;
  machine_label: string | null;
  vendor_name: string | null;
  location_address: string | null;
  harvest_date: string | null;
  booking_date: string;
  bill_amount: number | null;
  estimate_amount: number | null;
  advance: number;
  received: number;
  outstanding: number;
  overpaid: number;
  work_state: string;
  pay_state: string;
  next_action: string;
  overdue: boolean;
}

/**
 * Kaam ki halat -- board ke rang aur naam.
 *
 * Wohi naam jo fehrist par hain. Ek hi cheez ke do naam do safhon par
 * likhna staff ko ye samjhata hai ke wo do alag cheezein hain.
 */
const WORK: Record<string, { key: TranslationKey; ring: string; chip: string }> = {
  nayi:         { key: "lb_w_new",      ring: "border-surface-300 dark:border-surface-700", chip: "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300" },
  schedule:     { key: "lb_w_schedule", ring: "border-blue-300 dark:border-blue-800",       chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  machine_gayi: { key: "lb_w_sent",     ring: "border-blue-400 dark:border-blue-700",       chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  chal_raha:    { key: "lb_w_running",  ring: "border-purple-300 dark:border-purple-800",   chip: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
  mukammal:     { key: "lb_w_done",     ring: "border-brand-300 dark:border-brand-800",     chip: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" },
};

// Agla kaam -- laal sirf paise ke liye, warna laal ka matlab khatam.
const ACTION: Record<string, { key: TranslationKey; tone: string }> = {
  rate_final_karein: { key: "mca_rate",      tone: "text-amber-700 dark:text-amber-300" },
  machine_bhejein:   { key: "mca_machine",   tone: "text-blue-700 dark:text-blue-300" },
  kaam_darj_karein:  { key: "mca_work",      tone: "text-purple-700 dark:text-purple-300" },
  bill_banayein:     { key: "mca_bill",      tone: "text-amber-700 dark:text-amber-300" },
  paisa_lena:        { key: "mca_money",     tone: "text-red-700 dark:text-red-300" },
  wapas_karein:      { key: "mca_refund",    tone: "text-red-700 dark:text-red-300" },
  vendor_ko_dena:    { key: "mca_vendor",    tone: "text-amber-700 dark:text-amber-300" },
  mukammal:          { key: "mca_done",      tone: "text-brand-700 dark:text-brand-300" },
};

export function LiveBoard() {
  const lang = useLang();
  const [cards, setCards] = useState<LiveCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchCards() {
    try {
      const res = await fetch("/api/machinery/live-board", { cache: "no-store" });
      const data = await res.json();
      setCards(data.cards ?? []);
      setLastUpdated(new Date());
    } catch {
      // chup chaap -- 30 second baad khud dobara koshish karega
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCards();
    const interval = setInterval(fetchCards, 30000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const aaj = cards.filter((c) => c.harvest_date === today).length;
  const chal = cards.filter((c) => c.work_state === "chal_raha").length;
  const guzri = cards.filter((c) => c.overdue).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <Count n={aaj} label={t("lb_today_harvest", lang)} />
          <Count n={chal} label={t("lb_running", lang)} />
          {guzri > 0 && <Count n={guzri} label={t("lb_overdue", lang)} tone="text-red-600 dark:text-red-400" />}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {lastUpdated ? `${t("lb_updated", lang)} ${lastUpdated.toLocaleTimeString()}` : t("lb_loading", lang)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const work = WORK[c.work_state] ?? WORK.nayi;
          const action = ACTION[c.next_action];

          return (
            <Link
              key={c.id}
              href={`/admin/machinery-rental/booking/${c.id}`}
              className={`block rounded-card border-2 bg-white p-4 shadow-card transition-colors hover:border-brand-400 dark:bg-surface-900 ${work.ring}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                {/* "Booking" ka lafz jaan boojh kar sath likha hai.
                    Sirf MB-2026-00003 khara ho to wo bande ka number
                    lagta hai -- aur ek hi kisan ki do bookingein do
                    alag bande jaise parhi jati hain. */}
                <span className="font-mono text-xs text-surface-400">
                  <span className="font-sans">{t("at_booking", lang)}</span> {c.booking_number}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${work.chip}`}>
                  {t(work.key, lang)}
                </span>
              </div>

              <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">
                {c.farmer_name}
                {c.farmer_code && (
                  <span className="ml-2 font-mono text-xs font-normal text-surface-400">{c.farmer_code}</span>
                )}
              </p>

              {/* Raqba aur fasal. Raqba hamesha maloom hota hai -- wo
                  booking ka pehla khana hai. Fasal na ho to us ka naam
                  hi nahi likhte, "null" nahi. */}
              <p className="mt-0.5 text-xs text-surface-500">
                {c.area > 0 ? `${c.area} ${t("mc_acres", lang)}` : t("lb_area_missing", lang)}
                {c.crop_type ? ` · ${c.crop_type}` : ""}
              </p>

              <p className="text-xs text-surface-500">
                {c.machine_label ?? t("lb_machine_pending", lang)}
                {c.vendor_name ? ` · ${c.vendor_name}` : ""}
              </p>

              {(c.location_address || c.village) && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-surface-400">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{[c.location_address, c.village].filter(Boolean).join(", ")}</span>
                </p>
              )}

              <p className={`mt-0.5 flex items-center gap-1 text-xs ${c.overdue ? "text-red-600 dark:text-red-400" : "text-surface-400"}`}>
                {c.overdue ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <CalendarClock className="h-3 w-3 shrink-0" />}
                {c.harvest_date ? new Date(c.harvest_date).toLocaleDateString() : t("lb_date_pending", lang)}
              </p>

              <div className="mt-2 flex items-end justify-between gap-2 border-t border-surface-100 pt-2 dark:border-surface-800">
                <span className={`text-xs font-medium ${action?.tone ?? "text-surface-500"}`}>
                  {action ? t(action.key, lang) : c.next_action}
                </span>
                <Money card={c} />
              </div>
            </Link>
          );
        })}

        {cards.length === 0 && !loading && (
          <p className="col-span-full py-8 text-center text-sm text-surface-400">{t("lb_empty", lang)}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Board par paisa.
 *
 * Tarteeb ahem hai: baqi > zyada > bill > andaza. Jo cheez ab karni
 * hai wo pehle dikhti hai.
 *
 * Andaza saaf "andaza" likha jata hai. Bill se pehle koi asal raqam
 * hoti hi nahi, aur andaze ko bill ki tarah dikhana wohi ghalti hai
 * jis se kisan se ghalat raqam maangi jati hai.
 */
function Money({ card }: { card: LiveCard }) {
  const lang = useLang();

  if (card.outstanding > 0) {
    return (
      <span className="whitespace-nowrap text-right text-sm font-semibold text-red-600 dark:text-red-400">
        Rs {card.outstanding.toLocaleString()}
        <span className="block text-[10px] font-normal text-surface-400">{t("mc_outstanding", lang)}</span>
      </span>
    );
  }
  if (card.overpaid > 0) {
    return (
      <span className="whitespace-nowrap text-right text-sm font-semibold text-red-600 dark:text-red-400">
        Rs {card.overpaid.toLocaleString()}
        <span className="block text-[10px] font-normal text-surface-400">{t("mc_refund_due", lang)}</span>
      </span>
    );
  }
  if (card.bill_amount !== null) {
    return (
      <span className="whitespace-nowrap text-right text-sm font-semibold text-brand-700 dark:text-brand-300">
        Rs {card.bill_amount.toLocaleString()}
        <span className="block text-[10px] font-normal text-surface-400">{t("lb_paid_full", lang)}</span>
      </span>
    );
  }
  if (card.estimate_amount !== null) {
    return (
      <span className="whitespace-nowrap text-right text-sm text-surface-500">
        Rs {Math.round(card.estimate_amount).toLocaleString()}
        <span className="block text-[10px] text-surface-400">{t("lb_estimate", lang)}</span>
      </span>
    );
  }
  return <span className="whitespace-nowrap text-xs text-surface-400">{t("lb_rate_pending", lang)}</span>;
}

function Count({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <span className="text-surface-600 dark:text-surface-400">
      <strong className={tone ?? "text-surface-900 dark:text-white"}>{n}</strong> {label}
    </span>
  );
}
