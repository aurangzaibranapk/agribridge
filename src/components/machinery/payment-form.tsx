"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { Plus } from "lucide-react";
import { recordFinalPayment, type ActionState } from "@/actions/machinery-lifecycle";

/**
 * Kisan se paisa lene ka khana -- EK jagah likha hua.
 *
 * Ye pehle booking ke safhe ke andar band tha. Malik ne kaha ke adaigi
 * kisan ke KHATE par darj honi chahiye -- wahin jahan hisaab saamne hai
 * -- aur baat theek hai: paisa lene wala banda khata dekh raha hota
 * hai, booking ka safha nahi. Usay wahan se yahan bhejna ek aisa qadam
 * hai jis ki koi wajah nahi.
 *
 * Magar us ke liye DOOSRA form banana sab se buri soorat hoti. Paise ke
 * usool (cash kis ke zimme, bank par khata lazmi, vendor ne rakha ya
 * diya, khata par daali gayi raqam ka koi cash entry nahi banta)
 * `recordFinalPayment` mein hain aur dono jagah wohi rehte -- magar
 * KHANA do jagah likha jata to ek din ek mein khata poochha jata aur
 * doosre mein nahi. Us farq ka pata mahine baad chalta, jab paisa aa to
 * gaya magar pahuncha kahin nahi.
 *
 * Is liye khana bhi ek hi hai, aur dono safhe isay bulate hain.
 */

export const initialState: ActionState = {};

export function Err({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
        {state.error}
      </p>
    );
  }
  // Kaam theek ho gaya magar us ka nateeja batana zaroori hai -- kitna
  // baqi raha, bill bana ya nahi. Khamoshi se guzar jana staff ko ye
  // sochne par majboor karta hai ke kuch hua bhi ya nahi.
  if (state.notice) {
    return (
      <p className="mb-2 rounded border border-brand-200 bg-brand-50 p-2 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300">
        {state.notice}
      </p>
    );
  }
  return null;
}

export function Submit({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
      {pending ? "..." : label}
    </Button>
  );
}

export function PaymentForm({
  bookingId,
  accounts,
  remaining,
  onRecorded,
}: {
  bookingId: string;
  accounts: Array<{ id: string; name: string; account_type: string }>;
  remaining: number;
  onRecorded?: () => void;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordFinalPayment, initialState);

  useEffect(() => {
    if (state.success) onRecorded?.();
  }, [state.success, onRecorded]);
  const [lines, setLines] = useState([0]);
  const [methods, setMethods] = useState<Record<number, string>>({ 0: "cash" });
  const [again, setAgain] = useState(false);

  // Adaigi darj hote hi khana band ho jata hai.
  //
  // Bhara hua khana jawab ke baad bhi khula rehna sab se mehnga
  // masla hai: banda samajhta hai ke shayad gaya nahi, aur dobara
  // dabata hai -- ek hi Rs 20,000 do dafa. (Yahi diesel ke sath ho
  // chuka hai.) Aur adaigi aa jaye to khana ye niche wale link se
  // khulta hai, apne aap nahi.
  //
  // Kisan ne paisa VENDOR ko diya ho to us se aage ka hisaab yahan
  // ka nahi rehta: wo vendor ke khate ki baat hai, aur wahan vendor
  // khud tasdeeq karta hai. Is liye wahan ka raasta bhi dikha dete
  // hain.
  if (state.success && !again) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-200">
          {state.notice ?? t("mc_payment_recorded", lang)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAgain(true);
              setLines([0]);
              setMethods({ 0: "cash" });
            }}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {t("mc_payment_more", lang)}
          </button>
          <Link href="/admin/machinery-rental/vendor-cash" className="text-sm text-surface-500 underline hover:text-surface-700">
            {t("mc_vendor_khata_link", lang)}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Err state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />

      {lines.map((i) => (
        <div key={i} className="grid grid-cols-3 gap-2 rounded-lg border border-surface-200 p-2 dark:border-surface-700">
          <div>
            <Label>{t("mc_method", lang)}</Label>
            <Select
              name={`line_${i}_method`}
              value={methods[i] ?? "cash"}
              onChange={(e) => setMethods({ ...methods, [i]: e.target.value })}
            >
              <option value="cash">{t("mc_cash", lang)}</option>
              <option value="bank">{t("mc_bank", lang)}</option>
              <option value="wallet">{t("mc_wallet", lang)}</option>
              <option value="khata">{t("mc_khata_credit", lang)}</option>
              <option value="vendor_collected">{t("mc_paid_to_vendor", lang)}</option>
            </Select>
          </div>
          <div>
            <Label>{t("mc_amount", lang)}</Label>
            <Input type="number" name={`line_${i}_amount`} step="0.01" />
          </div>
          <div>
            {/* Vendor ke haath gaya hua paisa kisi khate mein nahi aaya
                -- wahan khata poochhna hi ghalat hai. Us jagah ye
                poochha jata hai ke vendor ne rakha ya hamein diya, aur
                hisaab mein dono bilkul alag hain. */}
            {methods[i] === "vendor_collected" ? (
              <>
                <Label>{t("mc_vendor_did_what", lang)}</Label>
                <Select name={`line_${i}_settlement`} defaultValue="">
                  <option value="">—</option>
                  <option value="kept">{t("mc_vendor_kept", lang)}</option>
                  <option value="handed_over">{t("mc_vendor_hands_over", lang)}</option>
                </Select>
              </>
            ) : methods[i] === "cash" ? (
              /* Cash par khata nahi poochha jata.
                 Khet par ya counter par liya hua cash us waqt kisi
                 khate mein hota hi nahi -- wo lene wale ki jeb mein
                 hota hai. Us ko khate mein likh dena ye kehta hai ke
                 paisa daftar pahunch gaya, jabke wo abhi raaste mein
                 hai. */
              <p className="mt-6 text-xs text-surface-500">{t("mc_cash_custody_note", lang)}</p>
            ) : (
              <>
                <Label>{t("mc_khata", lang)}</Label>
                <Select name={`line_${i}_account_id`} defaultValue="">
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </div>
        </div>
      ))}

      {lines.length < 5 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setLines([...lines, lines.length])}>
          <Plus className="h-4 w-4" /> {t("mc_add_split", lang)}
        </Button>
      )}

      <p className="text-xs text-surface-500">
        Khata par daali gayi raqam ka koi cash/bank entry nahi banta — wo kisan ke khate mein hi pari rehti hai. Baqi har
        raaste ka apna khata hona zaroori hai, warna paisa aa to gaya magar pahuncha kahin nahi.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("mc_date", lang)}</Label>
          <Input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        {/* Cash kahan liya. Dono soorton mein wo lene wale ke naam par
            khara hota hai -- magar do mahine baad poochho to ye farq
            kisi ko yaad nahi rehta. */}
        {Object.values(methods).includes("cash") && (
          <div>
            <Label>{t("mc_cash_where", lang)}</Label>
            <Select name="received_location" defaultValue="field">
              <option value="field">{t("mc_cash_field", lang)}</option>
              <option value="office">{t("mc_cash_office", lang)}</option>
            </Select>
          </div>
        )}
      </div>
      <Submit label={t("mc_record_payment", lang)} />
    </form>
  );
}
