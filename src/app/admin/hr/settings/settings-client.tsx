"use client";

import { useFormState, useFormStatus } from "react-dom";
import { CalendarOff, Clock, Lock, Trash2, Unlock, UserCheck } from "lucide-react";
import { saveLeavePolicy } from "@/actions/hr-probation";
import {
  lockAttendanceMonth,
  removeHoliday,
  reopenAttendanceMonth,
  saveHoliday,
  saveWorkSchedule,
  type AttState,
} from "@/actions/hr-attendance";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select } from "@/components/ui/form";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const initial: AttState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

function Msg({ state }: { state: AttState }) {
  if (state.error) return <p className="mt-2 text-xs text-red-700">{state.error}</p>;
  if (state.notice) return <p className="mt-2 text-xs text-emerald-700">{state.notice}</p>;
  return null;
}

export function SettingsClient({
  lang,
  schedule,
  holidays,
  locks,
  branches,
  currentYear,
  currentMonth,
  policy,
}: {
  lang: Lang;
  schedule: { weeklyOffDays: number[]; shiftStart: string; shiftEnd: string; grace: number; halfDayMax: number } | null;
  holidays: { id: string; date: string; name: string; isPaid: boolean }[];
  locks: { id: string; year: number; month: number; lockedAt: string; note: string | null; reopenedAt: string | null; reopenReason: string | null }[];
  branches: { id: string; name: string }[];
  currentYear: number;
  currentMonth: number;
  policy: {
    annualDays: number;
    probationMonths: number;
    probationMax: number;
    probationPaidLeave: boolean;
    prorateFirstYear: boolean;
    carryForward: number;
  } | null;
}) {
  const [schedState, schedAction] = useFormState(saveWorkSchedule, initial);
  const [holState, holAction] = useFormState(saveHoliday, initial);
  const [delState, delAction] = useFormState(removeHoliday, initial);
  const [lockState, lockAction] = useFormState(lockAttendanceMonth, initial);
  const [openState, openAction] = useFormState(reopenAttendanceMonth, initial);
  const [polState, polAction] = useFormState(saveLeavePolicy, initial);

  const off = schedule?.weeklyOffDays ?? [0];

  // Pichhla mahina -- band karne ke liye wohi tajweez hoti hai, chalta
  // hua mahina nahi.
  const prev = currentMonth === 1 ? { y: currentYear - 1, m: 12 } : { y: currentYear, m: currentMonth - 1 };

  return (
    <div className="space-y-4">
      {/* ---- Kaam ka waqt ---- */}
      <Card>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="h-4 w-4" /> {t("hrs_shift", lang)}
        </h2>
        <form action={schedAction} className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="shift_start">{t("hrs_shift_start", lang)}</Label>
            <Input id="shift_start" type="time" name="shift_start" defaultValue={schedule?.shiftStart ?? "09:00"} />
          </div>
          <div>
            <Label htmlFor="shift_end">{t("hrs_shift_end", lang)}</Label>
            <Input id="shift_end" type="time" name="shift_end" defaultValue={schedule?.shiftEnd ?? "17:00"} />
          </div>
          <div>
            <Label htmlFor="grace">{t("hrs_grace", lang)}</Label>
            <Input id="grace" type="number" name="late_grace_minutes" min={0} max={240} defaultValue={schedule?.grace ?? 15} />
          </div>
          <div>
            <Label htmlFor="hdm">Aadha din (minute)</Label>
            <Input id="hdm" type="number" name="half_day_max_minutes" min={0} max={1440} defaultValue={schedule?.halfDayMax ?? 300} />
          </div>

          <div className="sm:col-span-4">
            <Label>{t("hrs_weekly_off", lang)}</Label>
            <div className="mt-1 flex flex-wrap gap-3">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <label key={d} className="inline-flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="weekly_off_days" value={d} defaultChecked={off.includes(d)} />
                  {t(`hra_dow_${d}` as TranslationKey, lang)}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-4">
            <Submit label={t("hrt_save", lang)} />
            <Msg state={schedState} />
          </div>
        </form>
      </Card>

      {/* ---- Chhutti aur aazmaish ka usool ---- */}
      <Card>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <UserCheck className="h-4 w-4" /> {t("hrl_policy", lang)}
        </h2>
        <form action={polAction} className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="ald">{t("hrl_annual_days", lang)}</Label>
            <Input id="ald" type="number" name="annual_leave_days" min={0} max={60} defaultValue={policy?.annualDays ?? 20} />
          </div>
          <div>
            <Label htmlFor="pmo">{t("hrl_probation_months", lang)}</Label>
            <Input id="pmo" type="number" name="probation_months" min={0} max={24} defaultValue={policy?.probationMonths ?? 3} />
          </div>
          <div>
            <Label htmlFor="pmx">{t("hrl_probation_max", lang)}</Label>
            <Input id="pmx" type="number" name="probation_max_total_months" min={0} max={24} defaultValue={policy?.probationMax ?? 6} />
          </div>
          <div>
            <Label htmlFor="cf">{t("hrl_carry", lang)}</Label>
            <Input id="cf" type="number" name="carry_forward_days" min={0} max={60} defaultValue={policy?.carryForward ?? 0} />
          </div>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="probation_paid_leave" value="yes" defaultChecked={policy?.probationPaidLeave ?? false} />
            {t("hrl_probation_paid", lang)}
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="prorate_first_year" value="yes" defaultChecked={policy?.prorateFirstYear ?? true} />
            {t("hrl_prorate", lang)}
          </label>

          {/* Ye jumla safhe par jaan boojh kar hai. Aazmaishi muddat
              badalne wale ko usi lamhe maloom hona chahiye ke ye
              pichhle faislon ko nahi chhuta. */}
          <p className="text-xs text-surface-500 sm:col-span-4">
            Aazmaishi muddat badalne se un logon ki tareekh nahi badalti jin ki aazmaish pehle shuru ho chuki hai — un se jo waada
            hua tha, wohi rehta hai. Naya usool naye logon par lagega.
          </p>

          <div className="sm:col-span-4">
            <Submit label={t("hrt_save", lang)} />
            <Msg state={polState} />
          </div>
        </form>
      </Card>

      {/* ---- Chhutti ke din ---- */}
      <Card>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <CalendarOff className="h-4 w-4" /> {t("hrs_holidays", lang)}
        </h2>

        <form action={holAction} className="mb-3 grid gap-2 sm:grid-cols-4">
          <Input type="date" name="holiday_date" required />
          <Input name="name" placeholder={t("hrs_holiday_name", lang)} required />
          <Select name="branch_id" defaultValue="">
            <option value="">Poori company</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div>
            <Submit label={t("hrs_add_holiday", lang)} />
          </div>
          <div className="sm:col-span-4">
            <Msg state={holState} />
          </div>
        </form>

        {holidays.length === 0 ? (
          <p className="text-sm text-surface-500">Is saal koi chhutti darj nahi.</p>
        ) : (
          <ul className="divide-y divide-surface-100">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span>
                  <span className="tabular-nums text-surface-500">{h.date}</span> — <span className="font-medium">{h.name}</span>
                  {!h.isPaid && <Badge tone="amber">Bila tankhwah</Badge>}
                </span>
                <form action={delAction}>
                  <input type="hidden" name="holiday_id" value={h.id} />
                  <button type="submit" className="text-surface-400 hover:text-red-600" aria-label="Hatayein">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Msg state={delState} />
      </Card>

      {/* ---- Mahine ka taala ---- */}
      <Card>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Lock className="h-4 w-4" /> {t("hrs_month_lock", lang)}
        </h2>
        <p className="mb-2 text-xs text-surface-600">{t("hrs_lock_note", lang)}</p>

        <form action={lockAction} className="mb-3 grid gap-2 sm:grid-cols-4">
          <Input type="number" name="lock_year" defaultValue={prev.y} min={2000} max={2100} required />
          <Select name="lock_month" defaultValue={String(prev.m)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <Select name="branch_id" defaultValue="">
            <option value="">Poori company</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div>
            <Submit label={t("hrs_lock_month", lang)} />
          </div>
          <div className="sm:col-span-4">
            <Msg state={lockState} />
          </div>
        </form>

        {locks.length > 0 && (
          <ul className="divide-y divide-surface-100">
            {locks.map((l) => (
              <li key={l.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {String(l.month).padStart(2, "0")}/{l.year}
                  </span>
                  {l.reopenedAt ? (
                    <Badge tone="amber">
                      <span className="inline-flex items-center gap-1">
                        <Unlock className="h-3 w-3" /> khula
                      </span>
                    </Badge>
                  ) : (
                    <Badge tone="green">
                      <span className="inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" /> band
                      </span>
                    </Badge>
                  )}
                  {l.note && <span className="text-xs text-surface-500">{l.note}</span>}
                </div>

                {l.reopenedAt ? (
                  <p className="mt-0.5 text-xs text-surface-500">{l.reopenReason}</p>
                ) : (
                  <form action={openAction} className="mt-1 flex flex-wrap gap-2">
                    <input type="hidden" name="lock_id" value={l.id} />
                    <Input name="reopen_reason" placeholder={t("hrs_reopen_reason", lang)} required className="max-w-xs" />
                    <Submit label={t("hrs_reopen", lang)} />
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <Msg state={openState} />
      </Card>
    </div>
  );
}
