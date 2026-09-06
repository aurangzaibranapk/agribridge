import { createServiceClient } from "@/lib/supabase/service";

/**
 * Manzoori ki qatar — ek hi jagah se, poore nizam ke liye.
 *
 * =====================================================================
 * YE FILE KYUN BANI (AUR EK SAFHA KYUN MITAYA GAYA)
 * =====================================================================
 *
 * Malik (6 September): *"Har activity har related department se hoti
 * hui CEO tak jani chahiye — realtime mein: kahan kya ho raha, kis stage
 * par kya pending hai, kya complete hai, kya process mein hai. Agar
 * already bana hai to theek hai, kuch miss hai to upgrade kar do. Pehle
 * bane ko update karo, behtar karo. Ek hi kaam baar baar naye tag naye
 * naam ke sath nahi hone chahiye."*
 *
 * Aakhri jumla mujh par tha. Maine `/admin/verification` ke naam se ek
 * NAYA safha bana diya tha, jab ke "Approval Inbox"
 * (`/admin/submissions`) pehle se maujood tha aur Command Center par us
 * ka apna department bhi bana hua tha. Ek hi kaam ke do naam ban gaye
 * the.
 *
 * Ab wo safha nahi hai. Us ka kaam Approval Inbox ke andar aa gaya hai,
 * aur ye file wo jagah hai jahan se DONO — Approval Inbox aur Command
 * Center — ek hi hisaab parhte hain.
 *
 * =====================================================================
 * EK HI HISAAB, DO JAGAH SE PARHA JAYE
 * =====================================================================
 *
 * Ye baat is project mein pehle bhi mehngi par chuki hai (127): jo adad
 * do jagah alag alag lagaya jaye, wo ek din do alag jawab dene lagta
 * hai. Is liye qatar ka hisaab yahan ek dafa hota hai.
 */

export interface QatarRow {
  /** Kis safhe se aayi. */
  kahan: string;
  kahanKaNaam: string;
  id: string;
  number: string;
  amount: number;
  tafseel: string;
  branchId: string | null;
  ghante: number;
  managerHours: number;
  headHours: number;
  /** Kis darje par ja chuki hai. */
  darja: "manager" | "head" | "malik";
}

export interface QatarKhulasa {
  kul: number;
  raqam: number;
  /** Hadd ke andar. */
  waqtPar: number;
  /** Manager ki hadd guzar gayi. */
  guzri: number;
  /** Ooper ja chuki. */
  ooper: number;
  /** Sab se purani ki umar (ghante). NULL = koi qatar hi nahi. */
  puraniUmar: number | null;
}

/** Har safhe ka apna darwaza. */
export const QATAR_KA_RAASTA: Record<string, string> = {
  kharche: "/admin/kharche",
  // Mazdoori ka apna safha maujood hai, magar us ka DARWAZA Paisa &
  // Khata hai -- shop par ek hi tag hona chahiye.
  mazdoori: "/admin/kharche",
  settlements: "/admin/settlements",
};

function darjaKaFaisla(ghante: number, managerHours: number, headHours: number): QatarRow["darja"] {
  if (ghante < managerHours) return "manager";
  if (ghante < headHours) return "head";
  return "malik";
}

/**
 * Safhon se aayi hui intezar wali qatarein.
 *
 * `branchId` dena manager ke liye hai — usay poore karobar ki qatarein
 * dikhana us ka waqt khata hai. Owner / Finance ke liye NULL bhejein.
 */
export async function manzooriKiQatar(branchId: string | null = null): Promise<QatarRow[]> {
  const service = createServiceClient() as unknown as { from: (t: string) => any };

  let q = service.from("v_manzoori_ki_qatar").select("*").order("ghante", { ascending: false }).limit(300);
  if (branchId) q = q.eq("branch_id", branchId);

  const { data } = await q;

  return ((data ?? []) as any[]).map((r) => {
    const ghante = Number(r.ghante ?? 0);
    const managerHours = Number(r.manager_hours ?? 12);
    const headHours = Number(r.head_hours ?? 24);
    return {
      kahan: String(r.kahan),
      kahanKaNaam: String(r.kahan_ka_naam),
      id: String(r.id),
      number: String(r.number),
      amount: Number(r.amount ?? 0),
      tafseel: String(r.tafseel ?? ""),
      branchId: (r.branch_id as string | null) ?? null,
      ghante,
      managerHours,
      headHours,
      darja: darjaKaFaisla(ghante, managerHours, headHours),
    };
  });
}

/**
 * Un qataron ka khulasa.
 *
 * "Sab se purani ki umar" NULL rehti hai jab koi qatar hi na ho. Sifar
 * likhna wahan jhoot hai — sifar kehta hai "dekh liya, kuch nahi hua",
 * jab ke yahan dekhne ko kuch tha hi nahi.
 */
export function qatarKaKhulasa(rows: QatarRow[]): QatarKhulasa {
  return {
    kul: rows.length,
    raqam: rows.reduce((s, r) => s + r.amount, 0),
    waqtPar: rows.filter((r) => r.darja === "manager").length,
    guzri: rows.filter((r) => r.darja === "head").length,
    ooper: rows.filter((r) => r.darja === "malik").length,
    puraniUmar: rows.length === 0 ? null : Math.max(...rows.map((r) => r.ghante)),
  };
}

/** Ghante ko bande ki zaban mein. */
export function umarLikhein(ghante: number): string {
  if (ghante < 1) return `${Math.round(ghante * 60)} minute`;
  const g = Math.floor(ghante);
  const m = Math.round((ghante - g) * 60);
  if (g < 24) return m > 0 ? `${g}h ${m}m` : `${g} ghante`;
  const din = Math.floor(g / 24);
  return `${din} din ${g % 24}h`;
}
