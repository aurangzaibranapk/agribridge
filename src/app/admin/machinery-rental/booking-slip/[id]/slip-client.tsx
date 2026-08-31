"use client";
import { useState } from "react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { emailMachineryBookingSlip, type ActionState } from "@/actions/machinery-rental";
import { Printer, MessageCircle, Mail, ArrowLeft, X } from "lucide-react";

const initialState: ActionState = {};

interface Slip {
  id: string;
  bookingNumber: string;
  bookingDate: string;
  harvestDate: string | null;
  billNumber: string | null;
  billDate: string | null;
  /** Bill ban chuka hai -- yani ye andaza nahi, asal hisaab hai. */
  isFinal: boolean;
  farmerName: string;
  farmerCode: string | null;
  farmerPhone: string | null;
  vendorName: string;
  machineLabel: string;
  cropType: string | null;
  locationAddress: string | null;
  area: number;
  rate: number;
  gross: number;
  harvestType: string | null;
  sabitArea: number | null;
  kutraArea: number | null;
  sabitRate: number | null;
  kutraRate: number | null;
  sabitAmount: number | null;
  kutraAmount: number | null;
  discount: number;
  discountReason: string | null;
  advanceAdjusted: number;
  previousPayment: number;
  dieselDeducted: number;
  received: number;
  balance: number;
}

export function MachinerySlipClient({ slip }: { slip: Slip }) {
  const lang = useLang();
  const [showEmail, setShowEmail] = useState(false);
  const shareText = [
    `Al Rana Traders — ${slip.isFinal ? "Machinery Bill" : "Machinery Booking Slip"} ${slip.billNumber ?? slip.bookingNumber}`,
    slip.farmerName,
    `${slip.vendorName} — ${slip.machineLabel}`,
    `${slip.area} acre × Rs ${slip.rate.toLocaleString()} = Rs ${slip.gross.toLocaleString()}`,
    slip.discount > 0 ? `Riayat: - Rs ${slip.discount.toLocaleString()}` : null,
    slip.discount > 0 ? `Bill: Rs ${(slip.gross - slip.discount).toLocaleString()}` : null,
    slip.received > 0 ? `Mila: Rs ${slip.received.toLocaleString()}` : null,
    `Baqi: Rs ${slip.balance.toLocaleString()}`,
    "",
    `Dekhein: ${typeof window !== "undefined" ? window.location.href : ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  function handlePrint() {
    window.print();
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }

  const isDono = slip.harvestType === "dono";

  return (
    <div className="mx-auto max-w-xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/machinery-rental" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> {t("mc_back", lang)}
        </Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" /> {t("mc_print_download", lang)}
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
          <button onClick={() => setShowEmail(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        </div>
      </div>

      {/* Browser default se rang nahi chhapta -- aur is parchi par rang
          sirf sajawat nahi hai: usi se maloom hota hai ke raqam baqi hai
          ya hisaab poora. Is liye chhapte waqt rang rakhne ko kaha jata
          hai. */}
      <style>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { margin: 14mm; } }`}</style>

      <div className="rounded-card border border-surface-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
        {/* Sar-e-warq. Kisan ke haath mein jane wala kaghaz hai, is liye
            teen sawal pehli nazar mein khatam hone chahiyen: kis ka
            kaghaz hai, kis cheez ka hai, aur maamla khatam hua ya baqi
            hai. Aakhri baat ka nishan upar hi lag jata hai -- warna
            banda poori parchi parh kar neeche pahunchta hai. */}
        <div className="mb-6 border-b-2 border-brand-600 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-surface-900">Al Rana Traders</h1>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-700">
                {slip.isFinal ? "Machinery — Final Bill" : t("mc_slip_title", lang)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-base font-semibold tabular-nums text-surface-900">
                {slip.billNumber ?? slip.bookingNumber}
              </p>
              <p className="text-xs text-surface-500">
                {new Date(slip.billDate ?? slip.bookingDate).toLocaleDateString()}
              </p>
              {slip.billNumber && (
                <p className="font-mono text-[10px] text-surface-400">{slip.bookingNumber}</p>
              )}
            </div>
          </div>
          {slip.isFinal && (
            <span
              className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                slip.balance > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-green-100 text-green-800"
              }`}
            >
              {slip.balance > 0 ? "Adaigi baqi hai" : "Hisaab poora ho chuka"}
            </span>
          )}
        </div>

        <div className="mb-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-400">{t("mc_farmer", lang)}</p>
          <p className="font-display text-xl font-semibold text-surface-900">{slip.farmerName}</p>
          <p className="text-xs text-surface-500">
            {[slip.farmerCode && `Code: ${slip.farmerCode}`, slip.farmerPhone && `Phone: ${slip.farmerPhone}`]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-surface-200 bg-surface-200">
          <div className="bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-surface-400">
              {t("mc_vendor_machine", lang)}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-surface-800">{slip.vendorName}</p>
            <p className="text-xs text-surface-500">{slip.machineLabel}</p>
          </div>
          <div className="bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-surface-400">Kaam</p>
            <p className="mt-0.5 text-sm font-semibold text-surface-800">
              {slip.cropType ?? "—"}
              {slip.harvestDate ? ` · ${new Date(slip.harvestDate).toLocaleDateString()}` : ""}
            </p>
            {slip.locationAddress && <p className="text-xs text-surface-500">{slip.locationAddress}</p>}
          </div>
        </div>

        {/* Hisaab ki qatarein -- har lakeer apne naam se.
            Pehle yahan ek hi lakeer thi aur wo purane khanon se banti
            thi: "null Days", "Rate: Rs 0". */}
        <div className="rounded-lg border border-surface-200">
          <div className="border-b border-surface-100 bg-surface-50 px-4 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
              {slip.isFinal ? "Asal kaam ka hisaab" : "Booking ka andaza"}
            </p>
          </div>
          <div className="space-y-1 px-4 py-3 text-sm tabular-nums">
            {isDono ? (
              <>
                {/* Do qism ki booking par do lakeerein -- aausat rate
                    dikhana wo adad dikhana hai jis par kabhi koi raazi
                    hi nahi hua tha (176). */}
                <SlipRow
                  label={`Sabit Parali — ${slip.sabitArea ?? 0} acre × Rs ${(slip.sabitRate ?? 0).toLocaleString()}`}
                  value={slip.sabitAmount ?? Math.round((slip.sabitArea ?? 0) * (slip.sabitRate ?? 0))}
                />
                <SlipRow
                  label={`Kutra — ${slip.kutraArea ?? 0} acre × Rs ${(slip.kutraRate ?? 0).toLocaleString()}`}
                  value={slip.kutraAmount ?? Math.round((slip.kutraArea ?? 0) * (slip.kutraRate ?? 0))}
                />
              </>
            ) : (
              <SlipRow
                label={`${slip.area} acre × Rs ${slip.rate.toLocaleString()} per acre`}
                value={slip.gross}
              />
            )}

            <div className="flex justify-between border-t border-surface-100 pt-1.5 font-medium text-surface-900">
              <span>Kul</span>
              <span>Rs {slip.gross.toLocaleString()}</span>
            </div>

            {/* Riayat kisan ko SAAF nazar aani chahiye.
                Chupa kar sirf kam raqam likh dena us se ye baat chheen
                leta hai ke us par ehsaan hua -- aur agli dafa wo usi kam
                raqam ko apna haq samajh kar aata hai. Us se pehle wo ye
                bhi dekhta hai ke Rs 30,000 se Rs 28,000 kaise hue. */}
            {slip.discount > 0 && (
              <>
                <div className="flex justify-between text-brand-700">
                  <span>Riayat{slip.discountReason ? ` — ${slip.discountReason}` : ""}</span>
                  <span>- Rs {slip.discount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-surface-100 pt-1.5 font-medium text-surface-900">
                  <span>Riayat ke baad bill</span>
                  <span>Rs {(slip.gross - slip.discount).toLocaleString()}</span>
                </div>
              </>
            )}

            {slip.dieselDeducted > 0 && <SlipRow label="Aap ka diesel (kata gaya)" value={-slip.dieselDeducted} />}
            {slip.advanceAdjusted > 0 && <SlipRow label="Advance (kata gaya)" value={-slip.advanceAdjusted} />}
            {slip.previousPayment > 0 && <SlipRow label="Pehle di hui raqam" value={-slip.previousPayment} />}
            {slip.received - slip.advanceAdjusted > 0 && (
              <SlipRow label="Baad mein mili raqam" value={-(slip.received - slip.advanceAdjusted)} />
            )}
          </div>

          <div
            className={`flex items-center justify-between px-4 py-4 ${
              slip.balance > 0 ? "bg-amber-50" : "bg-green-50"
            }`}
          >
            <span className="text-sm font-semibold text-surface-700">
              {slip.balance > 0 ? "Baqi dena hai" : "Hisaab poora"}
            </span>
            <span
              className={`font-display text-3xl font-bold tabular-nums ${
                slip.balance > 0 ? "text-amber-700" : "text-green-700"
              }`}
            >
              Rs {slip.balance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Dastkhat ki lakeerein sirf CHHAPTE waqt aati hain.
            Screen par ye khali jagah bemaani hai, magar kaghaz par yehi
            wo cheez hai jo parchi ko raseed banati hai -- kisan ke paas
            iska saboot rehta hai ke us ne ye kaghaz liya aur is par
            raazi hua. */}
        {slip.isFinal && (
          <div className="mt-10 hidden grid-cols-2 gap-10 print:grid">
            <div>
              <div className="border-t border-surface-400 pt-1.5" />
              <p className="text-[11px] text-surface-500">Kisan ke dastkhat</p>
            </div>
            <div>
              <div className="border-t border-surface-400 pt-1.5" />
              <p className="text-[11px] text-surface-500">Al Rana Traders ki taraf se</p>
            </div>
          </div>
        )}

        {!slip.isFinal && (
          <p className="mt-3 rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-500">
            Ye booking ka andaza hai. Asal bill kattai ke baad, waqai kaate gaye acre par banega.
          </p>
        )}

        <div className="mt-8 border-t border-surface-100 pt-3">
          <p className="text-center text-[10px] text-surface-300">{t("mc_slip_footer", lang)}</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-surface-400">Software by ZR Technologies</p>
            <p className="text-xs text-surface-400">0312-6513294</p>
          </div>
        </div>
      </div>

      {showEmail && <EmailModal bookingId={slip.id} onClose={() => setShowEmail(false)} />}
    </div>
  );
}

/** Parchi ki ek lakeer -- manfi raqam apne aap "-" ke sath aati hai. */
function SlipRow({ label, value }: { label: string; value: number }) {
  // Manfi sifar ko sifar likha jaye: kharche wali lakeerein `value={-x}`
  // bhejti hain, aur x sifar ho to JavaScript mein `-0` banta hai. `-0 < 0`
  // GHALAT hai, is liye neeche wali shart usay manfi nahi samajhti aur
  // seedha "-0" chhaap deti hai. Paise ke safhe par "Rs -0" parh kar banda
  // rukta hai aur sochta hai kya cheez manfi hai. Kuch bhi nahi.
  const v = value === 0 ? 0 : value;
  return (
    <div className="flex justify-between text-surface-600">
      <span>{label}</span>
      <span>{v < 0 ? `- Rs ${Math.abs(v).toLocaleString()}` : `Rs ${v.toLocaleString()}`}</span>
    </div>
  );
}

function EmailModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(emailMachineryBookingSlip, initialState);
  if (state.success) setTimeout(onClose, 1200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("mc_send_by_email", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">Professional PDF slip seedha attachment ki tarah email mein chali jayegi.</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("mc_email_sent", lang)}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="email" name="to_email" required placeholder={t("mc_email_address", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
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