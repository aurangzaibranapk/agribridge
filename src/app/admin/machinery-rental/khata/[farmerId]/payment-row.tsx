"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PaymentForm } from "@/components/machinery/payment-form";
import { t } from "@/lib/i18n/translations";
import type { Lang } from "@/lib/i18n/translations";

/**
 * Khate par ek baqi wali booking -- aur usi jagah paisa lene ka khana.
 *
 * KHANA BAND RAHTA HAI, KHULTA MAANGNE PAR. Kisan ke kai bookings baqi
 * ho sakti hain; sab ke form ek sath khule rakhna do kharabiyan laata
 * hai -- safha itna lamba ho jata ke hisaab hi nazar na aaye, aur staff
 * ghalti se doosri booking wale khane mein raqam likh deta. Ek waqt
 * mein ek hi khana khula rehta hai, aur us par booking ka number bara
 * likha hota hai.
 *
 * Khana khud yahan nahi likha -- wohi component hai jo booking ke safhe
 * par lagta hai. Do nakalein banate to kal ek jagah qaida badalta aur
 * doosri purani reh jati, aur wo farq paise ka hota.
 */
export function KhataPaymentRow({
  bookingId,
  bookingNumber,
  due,
  accounts,
  lang,
}: {
  bookingId: string;
  bookingNumber: string;
  due: number;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="rounded-card border border-surface-200 dark:border-surface-700">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div>
          <p className="font-medium text-surface-800 dark:text-surface-200">{bookingNumber}</p>
          <p className="text-xs text-surface-500">
            {t("mk_to_collect", lang)}: Rs {due.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Booking ka poora safha yahan se ek click par -- wahan bill,
              vendor ka hissa aur wada sab hai. Ye link hata dena us
              raaste ko band kar deta. */}
          <Link
            href={`/admin/machinery-rental/booking/${bookingId}`}
            className="text-xs text-surface-500 underline hover:text-surface-700 dark:hover:text-surface-300"
          >
            {t("mk_open_booking", lang)}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            {t("mk_record_payment", lang)}
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-surface-200 p-3 dark:border-surface-700">
          <PaymentForm
            bookingId={bookingId}
            accounts={accounts}
            remaining={due}
            /* Adaigi darj hote hi upar wala hisaab dobara mangwaya jata
               hai. Warna staff paisa darj kar ke bhi wahi purana "baqi"
               dekhta rehta -- aur samajhta ke gaya hi nahi. */
            onRecorded={() => router.refresh()}
          />
        </div>
      )}
    </div>
  );
}
