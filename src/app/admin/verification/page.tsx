import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const DEKH_SAKTE = ["manager", "admin_assistant", "finance"];

/** Ghante ko bande ki zaban mein. */
function umar(ghante: number): string {
  if (ghante < 1) return `${Math.round(ghante * 60)} minute`;
  const g = Math.floor(ghante);
  const m = Math.round((ghante - g) * 60);
  if (g < 24) return m > 0 ? `${g}h ${m}m` : `${g} ghante`;
  const din = Math.floor(g / 24);
  return `${din} din ${g % 24}h`;
}

/**
 * Har qatar apne darwaze par.
 *
 * Mazdoori ka apna safha maujood hai, magar us ka DARWAZA ab Paisa &
 * Khata hai -- malik ka usool: *"shop par ek hi tag ho jis mein Paisa &
 * Khata ho."* Wahan wo qatarein bhi hain aur manzoori ka button bhi.
 */
const KAHAN_KA_RAASTA: Record<string, string> = {
  kharche: "/admin/kharche",
  mazdoori: "/admin/kharche",
  settlements: "/admin/settlements",
};

/**
 * Manzoori ki qatar — teenon jagah ki, ek fehrist mein.
 *
 * =====================================================================
 * MALIK KA NAQSHA (6 September)
 * =====================================================================
 *
 *   *"Main is mein proper Verification SLA rakhunga. Manager: 12 hours.
 *   12 hours cross: OVERDUE. Phir configurable escalation: 0–12 Hours ->
 *   Manager, 12–24 -> Manager + Department Head/Admin, 24+ -> CEO /
 *   Owner Dashboard."*
 *
 *   *"CEO ko 100 normal entries nahi dikhani. Sirf exception."*
 *
 * Ye doosra jumla poore safhe ka rukh badal deta hai. Malik ke saamne
 * pending qatarein daal dena wohi shor paida karta hai jise koi nahi
 * parhta. Is liye do alag jawab bante hain:
 *
 *   * Manager ko: poori fehrist, umar ke sath, purani sab se ooper.
 *   * Malik ko: SIRF wo jo hadd se guzar chuki hain — ginti, sab se
 *     purani ki umar, aur us mein phansi hui raqam.
 *
 * Waqt ki hadd database mein hai, code mein nahi -- malik ne "for
 * example" kaha tha, yani ye adad pathar par nahi.
 */
export default async function VerificationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const role = String(me?.role ?? "");
  const sabKuchWala = UNRESTRICTED_ROLES.includes(role);
  if (!sabKuchWala && !DEKH_SAKTE.includes(role)) redirect("/admin/permissions-denied");

  const service = createServiceClient();
  const loose = service as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any }>;
  };

  let q = loose.from("v_manzoori_ki_qatar").select("*").order("ghante", { ascending: false }).limit(300);
  // Manager ko us ki apni shaakh. Owner / Finance ko sab -- wo kisi ek
  // shaakh ke nahi hote.
  if (role === "manager" && me?.branch_id) q = q.eq("branch_id", me.branch_id);

  const [{ data: rawRows }, { data: khulasa }] = await Promise.all([
    q,
    loose.rpc("fn_manzoori_ka_khulasa"),
  ]);

  const rows = ((rawRows ?? []) as any[]).map((r) => ({
    kahan: String(r.kahan),
    kahanKaNaam: String(r.kahan_ka_naam),
    number: String(r.number),
    amount: Number(r.amount ?? 0),
    tafseel: String(r.tafseel ?? ""),
    ghante: Number(r.ghante ?? 0),
    managerHours: Number(r.manager_hours ?? 12),
    headHours: Number(r.head_hours ?? 24),
  }));

  const darje = new Map<string, { ginti: number; umar: number | null; raqam: number }>();
  ((khulasa ?? []) as any[]).forEach((k) => {
    darje.set(String(k.darja), {
      ginti: Number(k.ginti ?? 0),
      // NULL rehta hai jab koi qatar hi nahi -- "0 ghante" likhna jhoot
      // hota, aur ye farq is project mein pehle bhi mehnga par chuka hai.
      umar: k.purani_umar == null ? null : Number(k.purani_umar),
      raqam: Number(k.phansi_raqam ?? 0),
    });
  });

  const malik = darje.get("malik") ?? { ginti: 0, umar: null, raqam: 0 };
  const head = darje.get("head") ?? { ginti: 0, umar: null, raqam: 0 };
  const manager = darje.get("manager") ?? { ginti: 0, umar: null, raqam: 0 };

  return (
    <div>
      <PageHeader
        title="Manzoori ki Qatar"
        description="Paisa & Khata, Mazdoori aur Adjustment — jo kuch intezar mein hai, umar ke sath"
      />

      {/* Malik ke liye: sirf exception */}
      {malik.ginti > 0 && (
        <div className="mt-4 rounded-card border border-red-200 bg-red-50 p-4 dark:border-surface-800 dark:bg-surface-900">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            {malik.ginti} qatarein hadd se guzar chuki hain
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-red-800 dark:text-red-300">
            <span>
              Sab se purani: <b className="tabular-nums">{malik.umar == null ? "—" : umar(malik.umar)}</b>
            </span>
            <span>
              Phansi hui raqam: <b className="tabular-nums">Rs. {Math.round(malik.raqam).toLocaleString()}</b>
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { naam: "Waqt ke andar", d: manager, rang: "emerald" },
          { naam: "Hadd se guzri — Manager", d: head, rang: "amber" },
          { naam: "Ooper ja chuki — Malik", d: malik, rang: "red" },
        ].map((k) => (
          <div
            key={k.naam}
            className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">{k.naam}</p>
            <p
              className={`mt-1 font-display text-2xl font-bold tabular-nums ${
                k.rang === "red"
                  ? "text-red-700 dark:text-red-400"
                  : k.rang === "amber"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {k.d.ginti}
            </p>
            <p className="mt-1 text-xs text-surface-500">
              {/*
                Ginti sifar hai to umar ka koi matlab nahi -- "0 ghante"
                likhna wo jhoot hai jis se CLAUDE.md mana karti hai.
              */}
              {k.d.ginti === 0
                ? "koi qatar nahi"
                : `sab se purani ${k.d.umar == null ? "—" : umar(k.d.umar)} · Rs ${Math.round(k.d.raqam).toLocaleString()}`}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Fehrist ({rows.length}) — purani sab se ooper
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">
            Manzoori ke intezar mein kuch nahi.
            {role === "manager" && " (Ye sirf aap ki shaakh ki qatarein hain.)"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                  <th className="py-2 pr-3">Umar</th>
                  <th className="py-2 pr-3">Kahan se</th>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Tafseel</th>
                  <th className="py-2 pr-3 text-right">Raqam</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ooper = r.ghante >= r.headHours;
                  const guzri = !ooper && r.ghante >= r.managerHours;
                  return (
                    <tr
                      key={`${r.kahan}-${r.number}`}
                      className="border-b border-surface-50 align-top last:border-0 dark:border-surface-800"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            ooper
                              ? "bg-red-100 text-red-800 dark:bg-surface-800 dark:text-red-300"
                              : guzri
                                ? "bg-amber-100 text-amber-800 dark:bg-surface-800 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-surface-800 dark:text-emerald-300"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {umar(r.ghante)}
                        </span>
                        {(ooper || guzri) && (
                          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-red-600">
                            overdue
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">{r.kahanKaNaam}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.number}</td>
                      <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{r.tafseel}</td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                        Rs. {r.amount.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        {/*
                          Manzoori yahan se nahi hoti -- us ke apne safhe
                          par hoti hai, jahan poori tafseel saamne hoti
                          hai. Fehrist mein se manzoori dena wo aadat
                          banata hai jis mein banda parhe baghair haan
                          kar deta hai.
                        */}
                        <Link
                          href={KAHAN_KA_RAASTA[r.kahan] ?? "/admin"}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Kholein <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
