import { createServiceClient } from "@/lib/supabase/service";

/**
 * Har kharabi ka indraj -- ek jagah se.
 *
 * Malik ka kehna (5 September): *"kahin bhi koi error aaye to mujhe pata
 * chal jaye -- code mein ho ya bill duplicating mein, POS ya inventory,
 * kahin bhi -- ek page par pata chal jaye, taake developer usay khatam
 * kar sake."*
 *
 * Aaj tak kharabi ka pata chalne ka ek hi raasta tha: koi banda
 * screenshot bheje. Jo kharabi kisi ne nahi dekhi -- ya dekhi magar
 * batai nahi -- wo kabhi theek nahi hoti. Isi session ki teen misalein:
 * Assistant ka "kuch masla ho gaya" (asal wajah do naamon ka farq),
 * machinery ki raseed ka duplicate key, aur tasveer ka 404. Teenon ka
 * asal paighaam server ke log mein para tha, jahan malik kabhi nahi
 * jate.
 *
 * DO USOOL:
 *
 * 1. **Ye kabhi kisi kaam ko nahi rokta.** Indraj nakaam ho jaye to bhi
 *    asal kaam apni jagah chalta hai -- aur bande ko wohi paighaam milta
 *    hai jo milna tha.
 *
 * 2. **Ek jaisi kharabiyan ek qatar mein.** `fingerprint` unhen jorta
 *    hai. Us mein se wo cheezein nikal di jati hain jo har dafa badalti
 *    hain (id, adad, tareekh) -- warna ek hi masla har dafa "nayi
 *    kharabi" ban jata aur safha parhne ke qabil na rehta.
 */

export type ErrorModule =
  | "code"
  | "pos"
  | "inventory"
  | "purchase"
  | "machinery"
  | "finance"
  | "products"
  | "ai"
  | "whatsapp"
  | "hr"
  | "milk"
  | "grain"
  | "website";

/**
 * 'rukawat' = kaam ruk gaya (sab se ahem)
 * 'ghalti'  = kuch ghalat hua magar kaam chalta raha
 * 'khabar'  = sirf jaanne ki baat
 */
export type ErrorSeverity = "rukawat" | "ghalti" | "khabar";

export interface ErrorReport {
  module: ErrorModule;
  message: string;
  route?: string | null;
  detail?: string | null;
  digest?: string | null;
  severity?: ErrorSeverity;
  actorId?: string | null;
}

/**
 * Paighaam ko us shakal mein laana jo har dafa ek jaisi rahe.
 *
 * Misal: `duplicate key value violates unique constraint
 * "uq_machinery_payment_receipt" ... (MR-2026-00001)` -- is mein raseed
 * ka number har dafa badalta hai. Us ko na hatayein to har adaigi ek
 * "nayi" kharabi ban jati hai, aur ye pata hi nahi chalta ke yehi masla
 * chalees dafa aa chuka hai.
 */
function fingerprintOf(module: string, message: string): string {
  const saaf = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "#id")
    .replace(/\b[a-z]{2,4}-\d{2,4}-\d{3,}\b/g, "#no")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "#date")
    .replace(/\b\d[\d,]*\.?\d*\b/g, "#n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return `${module}:${saaf}`;
}

export async function recordError(e: ErrorReport): Promise<void> {
  try {
    const message = String(e.message ?? "").trim().slice(0, 500);
    if (!message) return;

    await createServiceClient()
      .from("error_log")
      .insert({
        fingerprint: fingerprintOf(e.module, message),
        module: e.module,
        route: e.route ? String(e.route).slice(0, 300) : null,
        message,
        detail: e.detail ? String(e.detail).slice(0, 4000) : null,
        digest: e.digest ? String(e.digest).slice(0, 100) : null,
        severity: e.severity ?? "ghalti",
        actor_id: e.actorId ?? null,
      });
  } catch {
    // Jaan boojh kar khamosh. Kharabi ka khata khud kharabi ban kar kaam
    // nahi rok sakta.
  }
}
