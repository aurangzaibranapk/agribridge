"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { MapPin, Phone, Tractor, CalendarRange } from "lucide-react";

export interface DayRow {
  machineId: string;
  machineCode: string;
  machineType: string;
  machineStatus: string;
  vendorName: string | null;
  date: string;
  capacity: number;
  booked: number;
  free: number;
  bookings: number;
  farmers: number;
  pct: number;
  state: string;
}
export interface MachineRow {
  id: string;
  code: string;
  type: string;
  model: string | null;
  status: string;
}
export interface LocationRow {
  jagah: string;
  acres: number;
  farmers: number;
  bookings: number;
}
export interface BookingRow {
  bookingId: string;
  bookingNumber: string;
  farmerName: string;
  farmerCode: string | null;
  farmerPhone: string | null;
  machineId: string | null;
  machineCode: string | null;
  machineType: string | null;
  crop: string | null;
  acres: number;
  harvestType: string | null;
  sabit: number | null;
  kutra: number | null;
  jagah: string;
  lat: number | null;
  lng: number | null;
  status: string;
  overrideReason: string | null;
}

/**
 * Halat ka rang -- aur us se bahar koi rang nahi.
 *
 * Hara sirf "jagah hai", ambar "thoRi jagah", laal "hadd se zyada",
 * aur band machine slate. Halat ka faisla database mein hota hai
 * (v_machinery_capacity_day), yahan sirf us ka rang chuna jata hai:
 * warna kisi din screen ka rang aur database ki halat alag ho jate.
 */
const STATE: Record<string, { cell: string; dot: string; label: string }> = {
  khali: { cell: "border-green-200 bg-green-50", dot: "bg-green-500", label: "mcal_st_khali" },
  thori_jagah: { cell: "border-amber-200 bg-amber-50", dot: "bg-amber-500", label: "mcal_st_thori" },
  bhara: { cell: "border-red-200 bg-red-50", dot: "bg-red-500", label: "mcal_st_bhara" },
  hadd_se_zyada: { cell: "border-red-300 bg-red-100", dot: "bg-red-600", label: "mcal_st_zyada" },
  band: { cell: "border-surface-200 bg-surface-100", dot: "bg-surface-400", label: "mcal_st_band" },
};

const BAR: Record<string, string> = {
  khali: "bg-green-500",
  thori_jagah: "bg-amber-500",
  bhara: "bg-red-500",
  hadd_se_zyada: "bg-red-600",
  band: "bg-surface-400",
};

export function CapacityPlanner({
  days,
  machines,
  locations,
  selectedMachine,
  selectedDay,
  dayRows,
}: {
  days: DayRow[];
  machines: MachineRow[];
  locations: LocationRow[];
  selectedMachine: string;
  selectedDay: string | null;
  dayRows: BookingRow[];
}) {
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();

  function go(next: { machine?: string; day?: string | null }) {
    const q = new URLSearchParams(params.toString());
    if (next.machine !== undefined) {
      if (next.machine === "all") q.delete("machine");
      else q.set("machine", next.machine);
      // Machine badalne par khula hua din band -- us machine par us din
      // ka hisaab alag hota hai, aur purana khula rakhna ghalat jorh
      // dikhata.
      q.delete("day");
    }
    if (next.day !== undefined) {
      if (next.day === null) q.delete("day");
      else q.set("day", next.day);
    }
    router.push(`/admin/machinery-rental/calendar?${q.toString()}`);
  }

  // Ek machine chuni ho to usi ki qatarein; warna sab machinon ka jorh
  // din ke hisaab se.
  const filtered = useMemo(
    () => (selectedMachine === "all" ? days : days.filter((d) => d.machineId === selectedMachine)),
    [days, selectedMachine]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, { capacity: number; booked: number; bookings: number; farmers: number }>();
    for (const d of filtered) {
      const cur = map.get(d.date) ?? { capacity: 0, booked: 0, bookings: 0, farmers: 0 };
      cur.capacity += d.capacity;
      cur.booked += d.booked;
      cur.bookings += d.bookings;
      cur.farmers += d.farmers;
      map.set(d.date, cur);
    }
    return [...map.entries()]
      .map(([date, v]) => {
        const pct = v.capacity > 0 ? Math.round((v.booked / v.capacity) * 100) : 100;
        const state =
          v.capacity === 0
            ? "band"
            : v.booked > v.capacity + 0.001
              ? "hadd_se_zyada"
              : v.booked >= v.capacity - 0.001
                ? "bhara"
                : pct > 60
                  ? "thori_jagah"
                  : "khali";
        return { date, ...v, free: Math.max(v.capacity - v.booked, 0), pct, state };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const summary = useMemo(() => {
    const capacity = byDate.reduce((s, d) => s + d.capacity, 0);
    const booked = byDate.reduce((s, d) => s + d.booked, 0);
    const activeMachines = new Set(
      filtered.filter((d) => d.capacity > 0).map((d) => d.machineId)
    ).size;
    return {
      capacity: Math.round(capacity * 100) / 100,
      booked: Math.round(booked * 100) / 100,
      free: Math.round(Math.max(capacity - booked, 0) * 100) / 100,
      util: capacity > 0 ? Math.round((booked / capacity) * 100) : 0,
      activeMachines,
    };
  }, [byDate, filtered]);

  // Machine ke hisaab se bojh -- agle 30 din ka jorh.
  const byMachine = useMemo(() => {
    const map = new Map<string, { code: string; booked: number; capacity: number }>();
    for (const d of days) {
      const cur = map.get(d.machineId) ?? { code: d.machineCode, booked: 0, capacity: 0 };
      cur.booked += d.booked;
      cur.capacity += d.capacity;
      map.set(d.machineId, cur);
    }
    return [...map.values()].sort((a, b) => b.booked - a.booked);
  }, [days]);

  // Ek machine ki hadd (chart ki lakeer ke liye). Sab machinein chuni
  // hon to lakeer un ka jorh hai.
  const capacityLine = byDate.length > 0 ? byDate[0].capacity : 0;

  const dayInfo = selectedDay ? byDate.find((d) => d.date === selectedDay) : null;
  const shownDayRows =
    selectedMachine === "all" ? dayRows : dayRows.filter((r) => r.machineId === selectedMachine);

  if (machines.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-card border border-dashed border-surface-300 bg-white px-4 py-10 text-center dark:border-surface-700 dark:bg-surface-900">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100 text-surface-400">
          <Tractor className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-medium text-surface-700 dark:text-surface-200">{t("mcal_no_machines", lang)}</p>
        <p className="mt-1 text-xs text-surface-500">{t("mcal_no_machines_hint", lang)}</p>
        <Link href="/admin/machinery-rental/machines" className="mt-3 text-sm font-medium text-brand-600 hover:underline">
          {t("mm_title", lang)}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Chunao aur khulasa */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedMachine}
          onChange={(e) => go({ machine: e.target.value })}
          className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="all">{t("mcal_all_machines", lang)}</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.type}
              {m.status === "maintenance" ? " (workshop)" : m.status === "inactive" ? " (band)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={t("mcal_machines", lang)} value={String(summary.activeMachines)} />
        <Kpi label={t("mcal_capacity", lang)} value={`${summary.capacity} acre`} />
        <Kpi label={t("mcal_booked", lang)} value={`${summary.booked} acre`} tone="amber" />
        <Kpi label={t("mcal_free", lang)} value={`${summary.free} acre`} tone="green" />
        <Kpi label={t("mcal_util", lang)} value={`${summary.util}%`} />
      </div>

      {/* 30 din ka jaal. Har khane mein tareekh nahi, us din ka bojh. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {byDate.map((d) => {
          const st = STATE[d.state] ?? STATE.khali;
          const active = selectedDay === d.date;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => go({ day: active ? null : d.date })}
              className={`rounded-card border p-2.5 text-left transition ${st.cell} ${
                active ? "ring-2 ring-brand-400" : "hover:border-brand-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-700">
                  {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
                <span className={`h-2 w-2 rounded-full ${st.dot}`} />
              </div>
              <p className="mt-1 font-display text-sm font-bold text-surface-900">
                {d.booked} / {d.capacity} <span className="text-xs font-normal">Ac</span>
              </p>
              <p className="text-[11px] text-surface-600">
                {d.farmers > 0 ? `${d.farmers} kisan` : t(st.label as never, lang)}
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                <div className={`h-full rounded-full ${BAR[d.state]}`} style={{ width: `${Math.min(d.pct, 100)}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Us din par ungli rakhi to us ki asal qatarein */}
      {selectedDay && dayInfo && (
        <div className="rounded-card border-2 border-brand-300 bg-white p-4 shadow-card dark:border-brand-900/50 dark:bg-surface-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 pb-2 dark:border-surface-800">
            <div>
              <p className="font-display text-base font-semibold text-surface-900 dark:text-white">
                {new Date(selectedDay + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </p>
              <p className="text-xs text-surface-500">
                {t("mcal_booked", lang)} {dayInfo.booked} / {dayInfo.capacity} acre · {t("mcal_remaining", lang)}{" "}
                <strong className={dayInfo.free > 0 ? "text-green-700" : "text-red-600"}>{dayInfo.free} acre</strong>
              </p>
            </div>
            <button type="button" onClick={() => go({ day: null })} className="text-xs text-surface-500 hover:underline">
              band karein
            </button>
          </div>

          {shownDayRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-surface-400">{t("mcal_no_booking", lang)}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {shownDayRows.map((r) => (
                <div key={r.bookingId} className="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-surface-900 dark:text-white">
                        {r.farmerName}
                        {r.farmerCode && <span className="ml-1 text-xs text-surface-400">{r.farmerCode}</span>}
                      </p>
                      <p className="text-xs text-surface-500">
                        {[r.crop, r.machineCode ?? r.machineType, r.jagah].filter(Boolean).join(" · ")}
                      </p>
                      {/* Qism ka batwara wahin dikhta hai jahan wo hai (176) */}
                      {r.harvestType === "dono" && (
                        <p className="text-xs text-surface-500">
                          {t("mh_sabit", lang)} {r.sabit ?? 0} · {t("mh_kutra", lang)} {r.kutra ?? 0}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-base font-semibold text-surface-900 dark:text-white">
                        {r.acres} acre
                      </p>
                      <p className="text-xs text-surface-400">{r.bookingNumber}</p>
                    </div>
                  </div>
                  {r.overrideReason && (
                    <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      {t("mcal_override", lang)}: {r.overrideReason}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <Link href={`/admin/machinery-rental/booking/${r.bookingId}`} className="font-medium text-brand-600 hover:underline">
                      {t("mcal_open_booking", lang)}
                    </Link>
                    {r.lat !== null && r.lng !== null && (
                      <a
                        href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-medium text-brand-600 hover:underline"
                      >
                        <MapPin className="h-3 w-3" /> Jagah
                      </a>
                    )}
                    {r.farmerPhone && (
                      <a href={`tel:${r.farmerPhone}`} className="flex items-center gap-1 font-medium text-brand-600 hover:underline">
                        <Phone className="h-3 w-3" /> Call
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            href={`/admin/machinery-rental/booking/new?preferred_date=${selectedDay}`}
            className="mt-3 inline-block rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("mcal_add_booking", lang)}
          </Link>
        </div>
      )}

      {/* Teen tasveerein -- teen alag sawal ka jawab */}
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <p className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("mcal_chart_daily", lang)}</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDate.map((d) => ({ din: d.date.slice(5), acre: d.booked }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="din" tick={{ fontSize: 11 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {/* Hadd ki lakeer -- is se upar ka har din tawajjo maangta hai */}
              {capacityLine > 0 && (
                <ReferenceLine
                  y={capacityLine}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  label={{ value: `Hadd ${capacityLine} acre`, position: "insideTopRight", fontSize: 11 }}
                />
              )}
              <Bar dataKey="acre" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("mcal_chart_location", lang)}</p>
          {locations.length === 0 ? (
            <p className="py-8 text-center text-sm text-surface-400">{t("mcal_no_booking", lang)}</p>
          ) : (
            <div className="space-y-2">
              {locations.slice(0, 8).map((l) => {
                const top = locations[0].acres || 1;
                return (
                  <div key={l.jagah}>
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-700 dark:text-surface-300">{l.jagah}</span>
                      <span className="font-medium text-surface-900 dark:text-white">{l.acres} acre</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(l.acres / top) * 100}%` }} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-surface-400">
                      {l.farmers} kisan · {l.bookings} booking
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("mcal_chart_machine", lang)}</p>
          {byMachine.length === 0 ? (
            <p className="py-8 text-center text-sm text-surface-400">{t("mcal_no_machines", lang)}</p>
          ) : (
            <div className="space-y-2">
              {byMachine.map((m) => (
                <div key={m.code}>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-700 dark:text-surface-300">{m.code}</span>
                    <span className="font-medium text-surface-900 dark:text-white">
                      {Math.round(m.booked * 100) / 100} / {Math.round(m.capacity * 100) / 100} acre
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${m.capacity > 0 ? Math.min((m.booked / m.capacity) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-surface-500">
        <CalendarRange className="h-3.5 w-3.5" />
        {t("mcal_cap_hint", lang)}
      </p>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "green" | "amber" }) {
  const color = tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : "text-surface-900 dark:text-white";
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
