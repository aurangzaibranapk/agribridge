import { createServiceClient } from "@/lib/supabase/service";

/**
 * "Poori profile ke baghair role nahi."
 *
 * Malik ka kehna (5 September): *"yahan hona chahiye admin ka role hum
 * kis ko dein, manager ka kis ko dein... jis jis ko dena hai us ki fully
 * profile bani hui honi chahiye tab hi."*
 *
 * Baat sirf tarteeb ki nahi. Adhoori profile par role de dena chhe mahine
 * baad takleef deta hai:
 *
 *   - CNIC na ho to tankhwah ki parchi aur bank ki adaigi ruk jati hai.
 *   - Afsar (reports_to) darj na ho to us ki har chhutti ki darkhwast
 *     seedhi HR ke paas jati hai -- manager ko pata hi nahi chalta ke us
 *     ka banda kal nahi aayega.
 *   - Shoba na ho to wo Team ke darakht mein kahin nazar nahi aata.
 *   - Emergency contact na ho to jis din waqai zaroorat parti hai, us
 *     din number dhoondha jata hai.
 *
 * Har ek akela masla chhota hai. Ikatthe ye wohi surat-e-haal banate
 * hain jahan "banda system mein hai" magar system us ke bare mein kuch
 * jaanta nahi.
 */

export interface Gap {
  key: string;
  label: string;
}

/** Jin logon ke paas doosron par ikhtiyar hota hai. */
const IKHTIYAR_WALE = ["owner", "super_admin", "admin", "manager", "hr", "finance"];

/** Jin ka koi afsar nahi hota -- wo khud sab se ooper hain. */
const BINA_AFSAR = ["owner", "super_admin"];

function khali(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

/**
 * Is role ke liye kya kya darj hona chahiye, aur kya kya nahi hai.
 *
 * Khali fehrist ka matlab hai "sab kuch darj hai". Ye us se ALAG hai ke
 * record parha hi na ja sake -- us surat mein ye function bulaya hi
 * nahi jata (dekhein `profileGaps`, jo aise mauqe par null deta hai).
 */
export function gapsFor(
  role: string,
  profile: { full_name?: string | null; phone_number?: string | null; branch_id?: string | null } | null,
  details: {
    cnic?: string | null;
    designation?: string | null;
    department_key?: string | null;
    hire_date?: string | null;
    reports_to?: string | null;
    employee_code?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  } | null
): Gap[] {
  const gaps: Gap[] = [];

  // ---- Har role ke liye ----
  if (khali(profile?.full_name)) gaps.push({ key: "full_name", label: "Poora naam" });
  if (khali(profile?.phone_number)) gaps.push({ key: "phone_number", label: "Mobile number" });
  if (khali(profile?.branch_id)) gaps.push({ key: "branch_id", label: "Branch" });

  // HR ka record hi na ho to har khana kam hai -- ek ek kar ke ginwana
  // behtar hai, kyunki "HR record nahi" se banda ye nahi samajhta ke
  // karna kya hai.
  if (khali(details?.cnic)) gaps.push({ key: "cnic", label: "CNIC" });
  if (khali(details?.designation)) gaps.push({ key: "designation", label: "Ohda (designation)" });
  if (khali(details?.department_key)) gaps.push({ key: "department_key", label: "Shoba" });
  if (khali(details?.hire_date)) gaps.push({ key: "hire_date", label: "Kab se kaam par hai" });

  // ---- Afsar ----
  if (!BINA_AFSAR.includes(role) && khali(details?.reports_to)) {
    gaps.push({ key: "reports_to", label: "Afsar (kis ko report karta hai)" });
  }

  // ---- Ikhtiyar wale roles ke liye zyada ----
  if (IKHTIYAR_WALE.includes(role)) {
    if (khali(details?.employee_code)) gaps.push({ key: "employee_code", label: "Employee code" });
    if (khali(details?.emergency_contact_name)) {
      gaps.push({ key: "emergency_contact_name", label: "Emergency contact ka naam" });
    }
    if (khali(details?.emergency_contact_phone)) {
      gaps.push({ key: "emergency_contact_phone", label: "Emergency contact ka number" });
    }
  }

  return gaps;
}

/**
 * Ek bande ki profile mein kya kami hai.
 *
 * Jawab teen mein se ek hota hai:
 *   []       -- sab kuch darj hai
 *   [ ... ]  -- ye khane khali hain
 *   null     -- **record parha nahi ja saka**
 *
 * Teesri surat ko doosri (ya pehli) samajh lena wohi ghalti hai jo is
 * project mein bar bar mehngi paRi hai. "Kuch nahi mila" aur "sab theek
 * hai" ek cheez nahi -- is liye null par role dena ROK diya jata hai,
 * chalne nahi diya jata.
 */
export async function profileGaps(profileId: string, role: string): Promise<Gap[] | null> {
  const service = createServiceClient();

  const [{ data: profile, error: pErr }, { data: details, error: dErr }] = await Promise.all([
    service.from("profiles").select("full_name, phone_number, branch_id").eq("id", profileId).maybeSingle(),
    service
      .from("staff_details")
      .select("cnic, designation, department_key, hire_date, reports_to, employee_code, emergency_contact_name, emergency_contact_phone")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);

  // Profile hi na mile to sawal hi khatam. Magar dono mein se koi bhi
  // GHALTI de to jawab "sab theek hai" nahi ho sakta.
  if (pErr || dErr) return null;
  if (!profile) return null;

  // details ka na hona ghalti nahi -- us ka matlab hai HR record abhi
  // bana hi nahi. Wo khud ek kami hai, aur gapsFor use ginn leta hai.
  return gapsFor(role, profile, details ?? null);
}
