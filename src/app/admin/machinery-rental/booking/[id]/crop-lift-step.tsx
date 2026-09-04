"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { tagCropLifter, untagCropLifter, recordCropLift, type LifterState } from "@/actions/crop-lifters";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const empty: LifterState = {};

export interface CropLiftInfo {
  lifterId: string;
  lifterName: string;
  status: "tagged" | "lifted" | "cancelled";
  commissionRate: number;
  cropValue: number | null;
  commission: number | null;
  kattai: number | null;
  purana: number | null;
  reliable: boolean | null;
  farmerPayable: number | null;
  lifterPayable: number | null;
}

/**
 * Fasal kaun uthayega -- aur uthane ke baad us ka bill.
 *
 * DO ALAG QADAM, JAAN BOOJH KAR. Tag sirf ek WADA hai: koi paisa nahi
 * hilta, sirf ye likha jata hai ke fasal kis ne uthani hai. Bill us waqt
 * banta hai jab fasal WAQAI utha li gayi ho aur us ki qeemat lag chuki
 * ho.
 *
 * Dono ko ek qadam bana dete to fasal uthne se pehle hi kisan ka baqi
 * kisi aur ke zimme chala jata -- aur agar sauda na hota to us raqam ka
 * malik kagaz par badal chuka hota, haqeeqat mein nahi.
 */
export function CropLiftStep({
  bookingId,
  lift,
  lifters,
  breakdown,
}: {
  bookingId: string;
  lift: CropLiftInfo | null;
  lifters: Array<{ id: string; name: string; commission_rate: number }>;
  /** Bill se pehle ka nazara -- kisan ka baqi is waqt kya hai. */
  breakdown: { kattai: number | null; purana: number | null; reliable: boolean; unposted: number | null };
}) {
  if (lift?.status === "lifted") return <LiftedBill bookingId={bookingId} lift={lift} />;
  if (lift) return <TaggedBox bookingId={bookingId} lift={lift} breakdown={breakdown} />;
  return <TagForm bookingId={bookingId} lifters={lifters} />;
}

/* ------------------------------------------------------------------ */

function TagForm({
  bookingId,
  lifters,
}: {
  bookingId: string;
  lifters: Array<{ id: string; name: string; commission_rate: number }>;
}) {
  const lang = useLang();
  const [state, action] = useFormState(tagCropLifter, empty);
  const [chosen, setChosen] = useState("");
  const rate = lifters.find((l) => l.id === chosen)?.commission_rate;

  if (lifters.length === 0) {
    return (
      <p className="text-sm text-surface-500">
        Abhi koi uthane wala darj nahi.{" "}
        <Link href="/admin/machinery-rental/lifters" className="font-medium text-brand-600 hover:underline">{t("ar_add_first", lang)}</Link>
        .
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <input type="hidden" name="booking_id" value={bookingId} />

      <p className="text-sm text-surface-600 dark:text-surface-300">{t("ar_who_lifts", lang)}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="lifter_id">{t("ar_lifter", lang)}</Label>
          <Select id="lifter_id" name="lifter_id" value={chosen} onChange={(e) => setChosen(e.target.value)} required>
            <option value="">—</option>
            {lifters.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.commission_rate}%)
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">{t("cl_note", lang)}</Label>
          <Input id="notes" name="notes" placeholder={t("ar_eg_note", lang)} />
        </div>
      </div>

      {/* Rate us bande ka apna hai. Yahan sirf dikha diya jata hai --
          badla nahi ja sakta, warna ek hi bande ke do saudon par do rate
          ho jate aur koi na bata pata ke theek kaun sa hai. */}
      {rate !== undefined && (
        <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
          {t("ar_rate_from_person", lang).replace("{rate}", String(rate))}
        </p>
      )}

      <Submit label={t("ar_attach", lang)} busy={t("ar_attaching", lang)} />
    </form>
  );
}

/* ------------------------------------------------------------------ */

function TaggedBox({
  bookingId,
  lift,
  breakdown,
}: {
  bookingId: string;
  lift: CropLiftInfo;
  breakdown: { kattai: number | null; purana: number | null; reliable: boolean; unposted: number | null };
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const blocked = !breakdown.reliable || breakdown.kattai === null || breakdown.purana === null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
        <p className="font-medium text-surface-800 dark:text-surface-200">{lift.lifterName}</p>
        <p className="text-xs text-surface-500">
          {t("ar_rate_on_value", lang).replace("{rate}", String(lift.commissionRate))}
        </p>
      </div>

      {/* Bill se pehle ka nazara. Staff ko pehle hi maloom hona chahiye
          ke is bill par kya kya kategi -- taake wo uthane wale ko sahi
          baat bata sake, aur bill banane ke baad hairan na ho. */}
      <div className="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-surface-500">{t("ar_farmer_due_now", lang)}</p>
        <Row label={t("ar_kattai_bill", lang)} value={breakdown.kattai} />
        <Row label={t("ar_purana_with_eg", lang)} value={breakdown.purana} />
        {/* KHALI aur SIFAR ek cheez nahi. Khali ka matlab "parha nahi ja
            saka" hai -- us par bill banana kisan se kam ya zyada maangne
            ka seedha raasta hai, is liye wahan darwaza band hai. */}
        {(breakdown.kattai === null || breakdown.purana === null) && (
          <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{t("ar_due_unreadable", lang)}</p>
        )}
        {breakdown.reliable === false && breakdown.kattai !== null && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {t("ar_unposted_warn", lang).replace("{n}", String(breakdown.unposted ?? "kuch"))}
          </p>
        )}
      </div>

      {!open && !blocked && (
        <Button type="button" onClick={() => setOpen(true)}>{t("ar_lifted_make_bill", lang)}</Button>
      )}

      {open && <LiftForm bookingId={bookingId} lift={lift} breakdown={breakdown} onCancel={() => setOpen(false)} />}

      {!open && <UntagForm bookingId={bookingId} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LiftForm({
  bookingId,
  lift,
  breakdown,
  onCancel,
}: {
  bookingId: string;
  lift: CropLiftInfo;
  breakdown: { kattai: number | null; purana: number | null; reliable: boolean; unposted: number | null };
  onCancel: () => void;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordCropLift, empty);
  const [value, setValue] = useState("");

  const v = Number(value) || 0;
  const kattai = breakdown.kattai ?? 0;
  const purana = breakdown.purana ?? 0;
  const commission = Math.round(((v * lift.commissionRate) / 100) * 100) / 100;
  const farmerPayable = Math.round((v - kattai - purana) * 100) / 100;
  const lifterPayable = Math.round((kattai + purana + commission) * 100) / 100;

  if (state.success) {
    return <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.notice}</p>;
  }

  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <input type="hidden" name="booking_id" value={bookingId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="crop_value">{t("ar_crop_value_q", lang)}</Label>
          {/* SIRF YE EK ADAD STAFF LIKHTA HAI. Baqi teen nizam nikalta
              hai -- haath ki likhai ek din hisaab se alag ho jati hai,
              aur us farq ka pata mahine baad chalta hai. */}
          <Input
            id="crop_value"
            name="crop_value"
            type="number"
            step="0.01"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="lift_date">{t("ar_date", lang)}</Label>
          <Input id="lift_date" name="lift_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>

      {v > 0 && (
        <div className="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
          <Row label={t("ar_crop_value", lang)} value={v} strong />
          <Row label={t("ar_kattai_bill", lang)} value={-kattai} />
          <Row label={t("ar_farmer_old_due", lang)} value={-purana} />
          <div className="mt-1 flex justify-between border-t border-surface-200 pt-1 font-medium dark:border-surface-700">
            <span>{t("ar_farmer_payable", lang)}</span>
            <span className={farmerPayable < 0 ? "text-red-600" : ""}>Rs {farmerPayable.toLocaleString()}</span>
          </div>
          <div className="mt-2 border-t border-surface-200 pt-2 dark:border-surface-700">
            <Row label={`${t("ar_our_commission", lang)} (${lift.commissionRate}%)`} value={commission} />
            <div className="mt-1 flex justify-between font-medium">
              <span>{t("ar_x_owes_us", lang).replace("{name}", lift.lifterName)}</span>
              <span>Rs {lifterPayable.toLocaleString()}</span>
            </div>
          </div>
          {/* Commission kisan ki jeb se NAHI katta -- malik ka faisla.
              Ye likha rehna zaroori hai, warna staff usay bhi kaat ke
              kisan ko kam paisa bata deta. */}
          <p className="mt-2 text-xs text-surface-500">
            {t("ar_commission_not_from_farmer", lang).replace("{name}", lift.lifterName)}
          </p>
          {farmerPayable < 0 && (
            <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{t("ar_due_more_than_value", lang)}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Submit label={t("ar_make_bill", lang)} busy={t("ar_making_bill", lang)} disabled={v <= 0 || farmerPayable < 0} />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t("ar_not_now", lang)}</Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function LiftedBill({ bookingId, lift }: { bookingId: string; lift: CropLiftInfo }) {
  const lang = useLang();
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-surface-800 dark:text-surface-200">{lift.lifterName}</p>
          <Link
            href={`/admin/machinery-rental/lifters/${lift.lifterId}`}
            className="text-xs font-medium text-brand-600 hover:underline"
          >{t("ar_his_khata", lang)}</Link>
        </div>
        <Row label={t("ar_crop_value", lang)} value={lift.cropValue} strong />
        <Row label={t("ar_kattai_bill", lang)} value={lift.kattai === null ? null : -lift.kattai} />
        <Row label={t("ar_farmer_old_due", lang)} value={lift.purana === null ? null : -lift.purana} />
        <div className="mt-1 flex justify-between border-t border-surface-200 pt-1 font-medium dark:border-surface-700">
          <span>{t("ar_farmer_payable", lang)}</span>
          <span>{lift.farmerPayable === null ? "—" : `Rs ${lift.farmerPayable.toLocaleString()}`}</span>
        </div>
        <div className="mt-2 border-t border-surface-200 pt-2 dark:border-surface-700">
          <Row label={`${t("ar_our_commission", lang)} (${lift.commissionRate}%)`} value={lift.commission} />
          <div className="mt-1 flex justify-between font-medium">
            <span>{t("ar_x_owes_us", lang).replace("{name}", lift.lifterName)}</span>
            <span>{lift.lifterPayable === null ? "—" : `Rs ${lift.lifterPayable.toLocaleString()}`}</span>
          </div>
        </div>
        {lift.reliable === false && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{t("ar_unreliable_bill", lang)}</p>
        )}
      </div>
      <p className="text-xs text-surface-500">
        {t("ar_moved_note", lang).replace("{name}", lift.lifterName)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function UntagForm({ bookingId }: { bookingId: string }) {
  const lang = useLang();
  const [state, action] = useFormState(untagCropLifter, empty);
  return (
    <form action={action}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <button type="submit" className="text-xs text-surface-400 underline hover:text-surface-700">{t("ar_remove_lifter", lang)}</button>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function Row({ label, value, strong = false }: { label: string; value: number | null; strong?: boolean }) {
  const v = value === 0 ? 0 : value;
  return (
    <div className="flex justify-between py-0.5">
      <span className={strong ? "font-medium text-surface-800 dark:text-surface-200" : "text-surface-600 dark:text-surface-300"}>
        {label}
      </span>
      <span className={strong ? "font-medium text-surface-900 dark:text-surface-100" : "text-surface-900 dark:text-surface-100"}>
        {v === null ? "—" : `${v < 0 ? "− " : ""}Rs ${Math.abs(v).toLocaleString()}`}
      </span>
    </div>
  );
}

function Submit({ label, busy, disabled }: { label: string; busy: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? busy : label}
    </Button>
  );
}
