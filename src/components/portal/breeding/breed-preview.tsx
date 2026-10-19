"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Janwar + tareekh chunein -> aage ki tareekhein foran (AI/natural). Labels server se aate hain. */
type Opt = { id: string; label: string; species: string };
export function BreedPicker({ animals, animal, date, max, labels, showPreview, inputCls, basePath }: {
  animals: Opt[]; animal: string; date: string; max: string; inputCls: string; basePath: string; showPreview: boolean;
  labels: { animal: string; date: string; pick: string; title: string; heat: string; pd: string; dry: string; calving: string; days: string; mon: string[] };
}) {
  const router = useRouter();
  const [a, setA] = useState(animal);
  const [d, setD] = useState(date);
  const sp = animals.find((x) => x.id === a)?.species ?? "cow";
  const g = sp === "buffalo" ? 310 : sp === "goat" ? 150 : 283;
  const add = (n: number) => {
    const t = new Date(`${d}T00:00:00Z`);
    if (Number.isNaN(t.getTime())) return "—";
    t.setUTCDate(t.getUTCDate() + n);
    return `${t.getUTCDate()} ${labels.mon[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
  };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[13px] font-semibold text-surface-800 dark:text-slate-100">{labels.animal}
          <select name="animal_id" required value={a} className={inputCls}
            onChange={(e) => { setA(e.target.value); router.replace(`${basePath}${basePath.includes("?") ? "&" : "?"}animal=${e.target.value}`, { scroll: false }); }}>
            <option value="">{labels.pick}</option>
            {animals.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-surface-800 dark:text-slate-100">{labels.date}
          <input type="date" name="event_date" required max={max} value={d} onChange={(e) => setD(e.target.value)} className={inputCls} />
        </label>
      </div>
      {showPreview && (
        <div className="rounded-2xl border border-violet-300 bg-gradient-to-br from-violet-500/10 to-pink-500/10 p-4 text-[13px] dark:border-violet-500/40" data-testid="preview">
          <b className="text-surface-900 dark:text-white">📅 {labels.title}</b>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([[labels.heat, add(21)], [labels.pd, `${add(35)} – ${add(45)}`], [labels.dry, add(g - 60)], [labels.calving, `${add(g)} (${g} ${labels.days})`]] as [string, string][]).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/70 p-2 text-[11.5px] text-surface-500 dark:bg-surface-900/60 dark:text-slate-400">{k}<b className="mt-0.5 block text-[13px] text-surface-900 dark:text-white">{v}</b></div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
