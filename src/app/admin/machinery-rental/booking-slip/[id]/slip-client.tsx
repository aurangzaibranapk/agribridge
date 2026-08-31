"use client";
import { useState } from "react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { emailMachineryBookingSlip, type ActionState } from "@/actions/machinery-rental";
import { Printer, MessageCircle, Mail, ArrowLeft, X } from "lucide-react";
import { ArtLogo } from "@/components/brand/art-logo";

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
  /** Isi kisan ki pichli bookingon ka baqi -- har ek apni qatar mein. */
  pichlaBaqi: Array<{ bookingNumber: string; billNumber: string | null; date: string | null; amount: number }>;
}

export function MachinerySlipClient({ slip }: { slip: Slip }) {
  const lang = useLang();
  const [showEmail, setShowEmail] = useState(false);

  // Pichla baqi aur is bill ka baqi -- do alag adad, aur un ka jor
  // teesra. Teenon saamne rakhne parte hain: kisan ye bhi jaanna chahta
  // hai ke is dafa ka kitna bana, aur ye bhi ke ab kul kitne dene hain.
  const pichlaKul = slip.pichlaBaqi.reduce((sum, r) => sum + r.amount, 0);
  const kulDena = Math.round((pichlaKul + slip.balance) * 100) / 100;

  const shareText = [
    `Al Rana Traders — ${slip.isFinal ? "Machinery Bill" : "Machinery Booking Slip"} ${slip.billNumber ?? slip.bookingNumber}`,
    slip.farmerName,
    `${slip.vendorName} — ${slip.machineLabel}`,
    `${slip.area} acre × Rs ${slip.rate.toLocaleString()} = Rs ${slip.gross.toLocaleString()}`,
    slip.discount > 0 ? `Riayat: - Rs ${slip.discount.toLocaleString()}` : null,
    slip.discount > 0 ? `Bill: Rs ${(slip.gross - slip.discount).toLocaleString()}` : null,
    slip.received > 0 ? `Mila: Rs ${slip.received.toLocaleString()}` : null,
    `Is bill ka baqi: Rs ${slip.balance.toLocaleString()}`,
    pichlaKul > 0 ? `Pichla baqi: Rs ${pichlaKul.toLocaleString()}` : null,
    pichlaKul > 0 ? `KUL DENA: Rs ${kulDena.toLocaleString()}` : null,
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


  const netBill = Math.round((slip.gross - slip.discount) * 100) / 100;

  return (
    <div className="mx-auto max-w-2xl p-4 print:max-w-none print:p-0">
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
          hai. Sath hi parchi ko tootne se rokte hain: aadha hisaab ek
          safhe par aur aadha doosre par kisi ke kaam ka nahi. */}
      <style>{`@media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { margin: 12mm; }
        .slip-sheet { break-inside: avoid; }
      }`}</style>

      <div className="slip-sheet overflow-hidden rounded-card border border-surface-200 bg-white shadow-card print:rounded-none print:border-0 print:shadow-none">
        {/* ------------------------------------------------------------
            Sar-e-warq: gehra sabz patta
            ------------------------------------------------------------
            Rang idare ke apne nishan se aaye hain -- hexagon ka andar
            wala sabz (#0D2818) aur us ka sona (#C9A227). Koi naya rang
            nahi banaya gaya: kisan ke haath mein jane wala kaghaz aur
            website ek hi karobar ke lagne chahiyen.

            Teen sawal yahin khatam ho jate hain: kaghaz kis ka hai, kis
            cheez ka hai, aur maamla khatam hua ya baqi. */}
        <div className="bg-[#0D2818] px-8 py-6 text-white">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <ArtLogo width={54} />
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">Al Rana Traders</h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#C9A227]">ART AgriBridge</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9A227]">
                {slip.isFinal ? "Final Bill" : t("mc_slip_title", lang)}
              </p>
              <p className="font-mono text-lg font-bold tabular-nums">{slip.billNumber ?? slip.bookingNumber}</p>
              <p className="text-xs text-white/70">
                {new Date(slip.billDate ?? slip.bookingDate).toLocaleDateString()}
              </p>
              {slip.billNumber && (
                <p className="font-mono text-[10px] text-white/45">{slip.bookingNumber}</p>
              )}
            </div>
          </div>
        </div>
        <div className="h-1 bg-[#C9A227]" />

        <div className="px-8 py-6">
          {/* Kis ka bill hai -- aur us ke saamne haalat ka nishan */}
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A9791A]">
                {t("mc_farmer", lang)}
              </p>
              <p className="font-display text-2xl font-semibold leading-tight text-surface-900">{slip.farmerName}</p>
              <p className="mt-0.5 text-xs text-surface-500">
                {[slip.farmerCode && `Code: ${slip.farmerCode}`, slip.farmerPhone && slip.farmerPhone]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            </div>
            {slip.isFinal && (
              <span
                className={`shrink-0 rounded-md border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  slip.balance + pichlaKul > 0
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-green-300 bg-green-50 text-green-800"
                }`}
              >
                {slip.balance + pichlaKul > 0 ? "Adaigi baqi" : "Poora ho chuka"}
              </span>
            )}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-surface-200 bg-surface-200">
            <div className="bg-[#F6F8F5] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-500">
                {t("mc_vendor_machine", lang)}
              </p>
              <p className="mt-1 text-sm font-semibold text-surface-900">{slip.vendorName}</p>
              <p className="text-xs text-surface-500">{slip.machineLabel}</p>
            </div>
            <div className="bg-[#F6F8F5] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-500">Kaam</p>
              <p className="mt-1 text-sm font-semibold text-surface-900">
                {slip.cropType ?? "—"}
                {slip.harvestDate ? ` · ${new Date(slip.harvestDate).toLocaleDateString()}` : ""}
              </p>
              {slip.locationAddress && <p className="text-xs text-surface-500">{slip.locationAddress}</p>}
            </div>
          </div>

          {/* --------------------------------------------------------
              Hisaab -- har lakeer apne naam se
              -------------------------------------------------------- */}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#0D2818] text-left text-white">
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  {slip.isFinal ? "Asal kaam ka hisaab" : "Booking ka andaza"}
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em]">
                  Raqam
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {isDono ? (
                <>
                  {/* Do qism ki booking par do lakeerein -- aausat rate
                      dikhana wo adad dikhana hai jis par kabhi koi raazi
                      hi nahi hua tha (176). */}
                  <TableRow
                    label={`Sabit Parali — ${slip.sabitArea ?? 0} acre × Rs ${(slip.sabitRate ?? 0).toLocaleString()}`}
                    value={slip.sabitAmount ?? Math.round((slip.sabitArea ?? 0) * (slip.sabitRate ?? 0))}
                  />
                  <TableRow
                    label={`Kutra — ${slip.kutraArea ?? 0} acre × Rs ${(slip.kutraRate ?? 0).toLocaleString()}`}
                    value={slip.kutraAmount ?? Math.round((slip.kutraArea ?? 0) * (slip.kutraRate ?? 0))}
                  />
                </>
              ) : (
                <TableRow
                  label={`${slip.area} acre × Rs ${slip.rate.toLocaleString()} per acre`}
                  value={slip.gross}
                />
              )}

              <TableRow label="Kul" value={slip.gross} strong />

              {/* Riayat kisan ko SAAF nazar aani chahiye. Chupa kar sirf
                  kam raqam likh dena us se ye baat chheen leta hai ke us
                  par ehsaan hua -- aur us se pehle wo ye sawal chhoRta
                  hai ke Rs 30,000 se Rs 28,000 kaise hue. */}
              {slip.discount > 0 && (
                <>
                  <TableRow
                    label={`Riayat${slip.discountReason ? ` — ${slip.discountReason}` : ""}`}
                    value={-slip.discount}
                    tone="brand"
                  />
                  <TableRow label="Riayat ke baad bill" value={netBill} strong />
                </>
              )}

              {slip.dieselDeducted > 0 && <TableRow label="Aap ka diesel (kata gaya)" value={-slip.dieselDeducted} />}
              {slip.advanceAdjusted > 0 && <TableRow label="Advance (kata gaya)" value={-slip.advanceAdjusted} />}
              {slip.previousPayment > 0 && <TableRow label="Pehle di hui raqam" value={-slip.previousPayment} />}
              {slip.received - slip.advanceAdjusted > 0 && (
                <TableRow label="Baad mein mili raqam" value={-(slip.received - slip.advanceAdjusted)} />
              )}
            </tbody>
          </table>

          {/* Is bill ka apna baqi. Pichla baqi bhi ho to ye adad halka
              rehta hai aur bara adad KUL DENA ban jata hai -- kyunke
              kisan ke liye asal sawal wohi hai. */}
          <div
            className={`flex items-center justify-between border-x border-b border-surface-200 px-4 ${
              pichlaKul > 0 ? "bg-[#F6F8F5] py-3" : "border-b-0 bg-[#0D2818] py-4"
            }`}
          >
            <span
              className={`text-sm font-semibold ${pichlaKul > 0 ? "text-surface-700" : "text-white/80"}`}
            >
              {pichlaKul > 0 ? "Is bill ka baqi" : slip.balance > 0 ? "Baqi dena hai" : "Hisaab poora"}
            </span>
            <span
              className={`font-display font-bold tabular-nums ${
                pichlaKul > 0 ? "text-lg text-surface-900" : "text-3xl text-[#F3D98B]"
              }`}
            >
              Rs {slip.balance.toLocaleString()}
            </span>
          </div>

          {pichlaKul > 0 && (
            <>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-100 text-left">
                    {/* Do khanon ki jagah ek -- warna is patti ke beech
                        mein ek lakeer aa jati hai jo kisi cheez ko alag
                        nahi kar rahi hoti. */}
                    <th
                      colSpan={2}
                      className="border-x border-surface-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-600"
                    >
                      Pichla baqi
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {slip.pichlaBaqi.map((r) => (
                    <TableRow
                      key={r.bookingNumber}
                      label={`${r.billNumber ?? r.bookingNumber}${r.date ? ` · ${new Date(r.date).toLocaleDateString()}` : ""}`}
                      value={r.amount}
                    />
                  ))}
                  <TableRow label="Pichla kul" value={pichlaKul} strong />
                </tbody>
              </table>

              <div className="flex items-center justify-between bg-[#0D2818] px-4 py-4">
                <span className="text-sm font-semibold uppercase tracking-wider text-white/80">Kul dena hai</span>
                <span className="font-display text-3xl font-bold tabular-nums text-[#F3D98B]">
                  Rs {kulDena.toLocaleString()}
                </span>
              </div>
            </>
          )}

          {/* Raqam alfaz mein. Ye sirf sajawat nahi: adad mein ek hindsa
              barhana aasan hai, alfaz badalna nahi. Har asal bill par
              yehi wajah se likhi jati hai. */}
          {slip.isFinal && kulDena > 0 && (
            <p className="mt-3 rounded-lg border border-dashed border-[#C9A227]/50 bg-[#FDFBF4] px-3 py-2 text-xs text-surface-600">
              <span className="font-semibold text-surface-700">Alfaz mein:</span> {rupeesInWords(kulDena)}
            </p>
          )}

          {!slip.isFinal && (
            <p className="mt-3 rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-500">
              Ye booking ka andaza hai. Asal bill kattai ke baad, waqai kaate gaye acre par banega.
            </p>
          )}

          {/* Dastkhat ki lakeerein sirf CHHAPTE waqt aati hain. Screen
              par ye khali jagah bemaani hai, magar kaghaz par yehi
              parchi ko raseed banati hai. */}
          {slip.isFinal && (
            <div className="mt-12 hidden grid-cols-2 gap-12 print:grid">
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
        </div>

        <div className="border-t border-[#C9A227]/40 bg-[#F6F8F5] px-8 py-3">
          <p className="text-center text-[10px] text-surface-400">{t("mc_slip_footer", lang)}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-surface-500">Software by ZR Technologies</p>
            <p className="text-xs text-surface-500">0312-6513294</p>
          </div>
        </div>
      </div>

      {showEmail && <EmailModal bookingId={slip.id} onClose={() => setShowEmail(false)} />}
    </div>
  );
}

/**
 * Hisaab ki ek qatar.
 *
 * Manfi sifar ko sifar likha jaye: kharche wali lakeerein `value={-x}`
 * bhejti hain, aur x sifar ho to JavaScript mein `-0` banta hai.
 * `-0 < 0` GHALAT hai, is liye neeche wali shart usay manfi nahi
 * samajhti aur seedha "-0" chhaap deti hai. Paise ke safhe par "Rs -0"
 * parh kar banda rukta hai aur sochta hai kya cheez manfi hai. Kuch bhi
 * nahi.
 */
function TableRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: number;
  strong?: boolean;
  tone?: "brand";
}) {
  const v = value === 0 ? 0 : value;
  return (
    <tr className={strong ? "bg-[#F6F8F5]" : ""}>
      <td
        className={`border-x border-b border-surface-200 px-4 py-2 ${
          strong ? "font-semibold text-surface-900" : tone === "brand" ? "text-brand-700" : "text-surface-600"
        }`}
      >
        {label}
      </td>
      <td
        className={`border-b border-r border-surface-200 px-4 py-2 text-right whitespace-nowrap ${
          strong ? "font-semibold text-surface-900" : tone === "brand" ? "text-brand-700" : "text-surface-700"
        }`}
      >
        {v < 0 ? `- Rs ${Math.abs(v).toLocaleString()}` : `Rs ${v.toLocaleString()}`}
      </td>
    </tr>
  );
}

/**
 * Raqam alfaz mein -- lakh aur crore wale hisaab se, jaise yahan likha
 * jata hai (Rs 1,50,000 = "One Lakh Fifty Thousand Rupees Only").
 *
 * Paise (decimal) jaan boojh kar nahi likhe jate: is karobar ke har
 * adad poore rupay ke hote hain, aur "Zero Paisa" likhna sirf lakeer
 * lambi karta hai.
 */
function rupeesInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Zero Rupees Only";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigit = (x: number): string =>
    x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ""}`;

  const threeDigit = (x: number): string =>
    x < 100
      ? twoDigit(x)
      : `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${twoDigit(x % 100)}` : ""}`;

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  if (crore) parts.push(`${threeDigit(crore)} Crore`);
  if (lakh) parts.push(`${twoDigit(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigit(thousand)} Thousand`);
  if (rest) parts.push(threeDigit(rest));

  return `${parts.join(" ")} Rupees Only`;
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