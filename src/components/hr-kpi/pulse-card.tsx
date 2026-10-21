import { createClient } from "@/lib/supabase/server";
import { submitPulse } from "@/actions/hr-kpi";
import { aajKaKhana } from "@/lib/utils/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };
const FACES = [
  { v: 1, e: "😞", l: "Bilkul nahi" },
  { v: 2, e: "🙁", l: "Kam" },
  { v: 3, e: "😐", l: "Theek" },
  { v: 4, e: "🙂", l: "Achha" },
  { v: 5, e: "😄", l: "Bohat achha" },
];

/** Mahana pulse (1-5). Gumnaam: HR sirf ikattha nateeja dekhta hai (kam se kam 3 jawab). */
export async function PulseCard({ userId, sp }: { userId: string; sp?: Record<string, string | string[] | undefined> }) {
  const db = createClient() as unknown as Db;
  const month = `${aajKaKhana().slice(0, 7)}-01`;
  const { data } = await db.from("hr_pulse_responses").select("id").eq("profile_id", userId).eq("period_month", month).maybeSingle();
  const ok = typeof sp?.ok === "string" ? sp.ok : null;
  const err = typeof sp?.err === "string" ? sp.err : null;
  return (
    <section className="mb-4 rounded-card border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-900/40 dark:bg-brand-950/20" data-testid="pulse-card">
      <p className="text-sm font-semibold text-surface-900 dark:text-white">Is mahine aap kaam se kitne khush hain?</p>
      <p className="mb-2 text-xs text-surface-500">Gumnaam: aap ka naam kisi ko nahi dikhta, sirf sab ka ausat.</p>
      {(ok || err) && <p className={`mb-2 text-xs ${err ? "text-red-600" : "text-emerald-700"}`}>{err ?? ok}</p>}
      {data ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">✔ Is mahine ka jawab de diya. Shukriya!</p>
      ) : (
        <form action={submitPulse} className="flex flex-wrap gap-2">
          {FACES.map((f) => (
            <button key={f.v} name="score" value={f.v} className="flex w-20 flex-col items-center rounded-xl border border-surface-200 bg-white py-2 text-xs hover:border-brand-400 dark:border-surface-700 dark:bg-surface-900" aria-label={`${f.v} - ${f.l}`}>
              <span className="text-2xl" aria-hidden>{f.e}</span>
              {f.l}
            </button>
          ))}
        </form>
      )}
    </section>
  );
}
