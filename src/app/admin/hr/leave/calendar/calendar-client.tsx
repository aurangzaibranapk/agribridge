"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Button } from "@/components/ui/form";

export interface LeaveItem {
  id: string;
  naam: string;
  se: string;
  tak: string;
  kism: string;
  halat: string;
  aadhaDin: boolean;
}

export interface HolidayItem {
  date: string;
  naam: string;
}

const MAHINE = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Hafta pir ke din se -- kaam ka hafta yahan pir se shuru hota hai.
const DIN = ["Pir", "Mangal", "Budh", "Jumeraat", "Juma", "Hafta", "Itwaar"];

const KISM: Record<string, string> = {
  annual: "salana",
  sick: "bimari",
  casual: "aam",
  unpaid: "bila tankhwah",
  maternity: "zachgi",
};

/** YYYY-MM-DD -- Date object se nahi, warna timezone din badal deta hai. */
function isoOf(saal: number, mah: number, din: number): string {
  return `${saal}-${String(mah + 1).padStart(2, "0")}-${String(din).padStart(2, "0")}`;
}

/**
 * Team ki chhutti ka mahina.
 *
 * Har din ke neeche wo naam jo us din nahi honge. Manzoor shuda naam
 * bhare hue, aur manzoori-baqi khaali khaanay wale -- taake manager
 * kabhi un par bharosa kar ke kaam na baante jo abhi tay hi nahi hua.
 */
export function LeaveCalendarClient({
  leaves,
  holidays,
  aajISO,
}: {
  leaves: LeaveItem[];
  holidays: HolidayItem[];
  aajISO: string;
}) {
  const [aajSaal, aajMah] = useMemo(() => {
    const [y, m] = aajISO.split("-").map(Number);
    return [y, m - 1];
  }, [aajISO]);

  // Server ne 6 mahine peeche se 6 aage tak ka record bheja hai. Us se
  // bahar ka mahina khaali dikhana jhoot hota -- is liye button hi band.
  const [faasla, setFaasla] = useState(0);
  const saal = aajSaal + Math.floor((aajMah + faasla) / 12);
  const mah = ((aajMah + faasla) % 12 + 12) % 12;

  const pehliTareekh = isoOf(saal, mah, 1);
  const kulDin = new Date(Date.UTC(saal, mah + 1, 0)).getUTCDate();
  const aakhriTareekh = isoOf(saal, mah, kulDin);

  // Pir = 0. JS mein Itwaar = 0 hota hai, is liye ek qadam ghumaya.
  const pehlaKhana = (new Date(Date.UTC(saal, mah, 1)).getUTCDay() + 6) % 7;

  const holidayMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const h of holidays) m.set(h.date, [...(m.get(h.date) ?? []), h.naam]);
    return m;
  }, [holidays]);

  // Har chhutti apni har tareekh par. Ek 5 din ki darkhwast paanch
  // khanon mein aati hai -- warna sirf shuru wala din khatre mein dikhta.
  const dinKeNaam = useMemo(() => {
    const m = new Map<string, LeaveItem[]>();
    for (const l of leaves) {
      const shuru = l.se > pehliTareekh ? l.se : pehliTareekh;
      const khatam = l.tak < aakhriTareekh ? l.tak : aakhriTareekh;
      if (shuru > khatam) continue;
      const d = new Date(`${shuru}T00:00:00Z`);
      const end = new Date(`${khatam}T00:00:00Z`);
      while (d <= end) {
        const key = d.toISOString().slice(0, 10);
        m.set(key, [...(m.get(key) ?? []), l]);
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
    return m;
  }, [leaves, pehliTareekh, aakhriTareekh]);

  const isMahineKi = useMemo(
    () => leaves.filter((l) => l.se <= aakhriTareekh && l.tak >= pehliTareekh),
    [leaves, pehliTareekh, aakhriTareekh]
  );
  const manzoor = isMahineKi.filter((l) => l.halat === "approved").length;
  const baqi = isMahineKi.filter((l) => l.halat === "pending").length;

  const khanay: (number | null)[] = [
    ...Array.from({ length: pehlaKhana }, () => null),
    ...Array.from({ length: kulDin }, (_, i) => i + 1),
  ];
  while (khanay.length % 7 !== 0) khanay.push(null);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => setFaasla((f) => f - 1)} disabled={faasla <= -6}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center font-display text-lg font-semibold text-surface-900 dark:text-white">
            {MAHINE[mah]} {saal}
          </span>
          <Button type="button" variant="ghost" onClick={() => setFaasla((f) => f + 1)} disabled={faasla >= 6}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {faasla !== 0 && (
            <Button type="button" variant="ghost" onClick={() => setFaasla(0)}>
              Aaj
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-brand-500" /> Manzoor shuda ({manzoor})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-dashed border-wheat-500 bg-wheat-400/20" /> Manzoori baqi ({baqi})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-blue-500" /> Idare ki chhutti
          </span>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-surface-200 bg-surface-50 text-center text-xs font-medium text-surface-500 dark:border-surface-800 dark:bg-surface-800/50 dark:text-surface-400">
          {DIN.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {khanay.map((din, i) => {
            if (din === null) {
              return <div key={`k${i}`} className="min-h-[7rem] border-b border-e border-surface-100 bg-surface-50/60 dark:border-surface-800 dark:bg-surface-900/40" />;
            }
            const tareekh = isoOf(saal, mah, din);
            const chhuttiNaam = holidayMap.get(tareekh);
            const log = dinKeNaam.get(tareekh) ?? [];
            const aaj = tareekh === aajISO;

            return (
              <div
                key={tareekh}
                className={
                  "min-h-[7rem] border-b border-e border-surface-100 p-1.5 dark:border-surface-800 " +
                  (chhuttiNaam ? "bg-blue-50/70 dark:bg-blue-950/20" : "")
                }
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                      (aaj
                        ? "bg-brand-600 text-white"
                        : "text-surface-500 dark:text-surface-400")
                    }
                  >
                    {din}
                  </span>
                  {log.length > 2 && (
                    <span className="text-[10px] font-medium text-surface-400">{log.length}</span>
                  )}
                </div>

                {chhuttiNaam?.map((n) => (
                  <div key={n} className="mb-1 truncate rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" title={n}>
                    {n}
                  </div>
                ))}

                <div className="space-y-0.5">
                  {log.map((l) => (
                    <div
                      key={l.id + tareekh}
                      title={`${l.naam} — ${KISM[l.kism] ?? l.kism}${l.aadhaDin ? " (aadha din)" : ""}${
                        l.halat === "pending" ? " — manzoori baqi" : ""
                      }`}
                      className={
                        "truncate rounded px-1.5 py-0.5 text-[11px] " +
                        (l.halat === "approved"
                          ? "bg-brand-500 font-medium text-white"
                          : "border border-dashed border-wheat-500 bg-wheat-400/20 text-wheat-700 dark:text-wheat-400")
                      }
                    >
                      {l.naam}
                      {l.aadhaDin && <span className="opacity-75"> ½</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {isMahineKi.length === 0 && (
        <Card className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
          <CalendarDays className="h-4 w-4" />
          Is mahine kisi ki chhutti darj nahi.
        </Card>
      )}
    </div>
  );
}
