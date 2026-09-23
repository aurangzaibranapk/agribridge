"use client";
import { useMemo, useState } from "react";

interface Qatar {
  tareekh: string;
  number: string;
  tafseel: string;
  module: string;
  khataCode: string;
  khataNaam: string;
  debit: number;
  credit: number;
  baqiParAsar: boolean;
}

/**
 * Module ka naam bande ki zaban mein.
 *
 * `source_module` code ka naam hai (`pos`, `milk_entry`). Usay waise hi
 * dikhana banday par ye bojh daalta hai ke wo code ki lughat yaad rakhe.
 */
const MODULE_NAAM: Record<string, string> = {
  pos: "Dukan (POS)",
  kharche: "Paisa & Khata",
  mazdoori: "Mazdoori",
  milk_entry: "Doodh",
  milk_dispatch: "Doodh",
  grain: "Anaj",
  grain_procurement: "Anaj",
  purchase: "Kharid",
  company_expense: "Kharcha",
  machinery: "Machinery",
  machinery_booking: "Machinery",
  khata: "Khata",
};

function moduleKaNaam(m: string) {
  return MODULE_NAAM[m] ?? m.replace(/_/g, " ");
}

/**
 * Bande ke khaate ki qatarein — aur un ki chhanti.
 *
 * Malik (6 September): *"Uske andar filters ho sakte hain: Sab | Milk |
 * Mazdoori | Shop | Agriculture | Grain | Machinery | Cash/Payment. Ye
 * alag khate nahi, sirf same ledger ke filters honge."*
 *
 * Is liye chhanti YAHIN banti hai, safhe par maujood qataron se — koi
 * tayyar fehrist nahi. Tayyar fehrist rakhne se wo naam bhi nazar aate
 * jin ki is bande par ek qatar bhi nahi, aur banda unhen kholta rehta
 * hai.
 */
export function BandaKhataClient({ qatarein }: { qatarein: Qatar[] }) {
  const [chhanti, setChhanti] = useState("sab");

  const moduleFehrist = useMemo(() => {
    const set = new Map<string, number>();
    qatarein.forEach((q) => set.set(q.module, (set.get(q.module) ?? 0) + 1));
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [qatarein]);

  const dikhne = useMemo(
    () => (chhanti === "sab" ? qatarein : qatarein.filter((q) => q.module === chhanti)),
    [qatarein, chhanti]
  );

  return (
    <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Poora khata ({qatarein.length})
        </h2>
        <button
          type="button"
          onClick={() => setChhanti("sab")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            chhanti === "sab"
              ? "bg-emerald-600 text-white"
              : "border border-surface-200 text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800"
          }`}
        >
          Sab ({qatarein.length})
        </button>
        {moduleFehrist.map(([m, n]) => (
          <button
            key={m}
            type="button"
            onClick={() => setChhanti(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              chhanti === m
                ? "bg-emerald-600 text-white"
                : "border border-surface-200 text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800"
            }`}
          >
            {moduleKaNaam(m)} ({n})
          </button>
        ))}
      </div>

      {qatarein.length === 0 ? (
        // "Kuch nahi mila" aur "kuch hua hi nahi" ek cheez nahi -- aur ye
        // farq yahan likha hua hai, warna khali safha dekh kar banda
        // samajhta hai ke us ka koi len-den hai hi nahi.
        <p className="text-sm text-surface-400">
          Is bande ke naam par ledger mein koi qatar nahi mili. Agar aap ko yaqeen hai ke len-den hua hai, to mumkin
          hai wo qatar bande ke naam ke baghair darj hui ho — Finance se poochhein.
        </p>
      ) : dikhne.length === 0 ? (
        <p className="text-sm text-surface-400">Is chhanti mein koi qatar nahi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                <th className="py-2 pr-3">Tareekh</th>
                <th className="py-2 pr-3">Tafseel</th>
                <th className="py-2 pr-3">Kahan se</th>
                <th className="py-2 pr-3">Khata</th>
                <th className="py-2 pr-3 text-right">Lena (+)</th>
                <th className="py-2 pr-3 text-right">Dena (+)</th>
              </tr>
            </thead>
            <tbody>
              {dikhne.map((q, i) => (
                <tr key={`${q.number}-${i}`} className="border-b border-surface-50 align-top last:border-0 dark:border-surface-800">
                  <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{q.tareekh}</td>
                  <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                    {q.tafseel}
                    <span className="block text-[11px] text-surface-400">{q.number}</span>
                  </td>
                  <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">{moduleKaNaam(q.module)}</td>
                  <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">
                    {q.khataNaam}
                    {!q.baqiParAsar && (
                      // Ye qatar us ke naam par hai magar us ka baqi nahi
                      // hilati -- jaise us ke haath gaya kharcha.
                      <span className="block text-[11px] text-surface-400">baqi par asar nahi</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {q.debit > 0 ? Math.round(q.debit).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                    {q.credit > 0 ? Math.round(q.credit).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
