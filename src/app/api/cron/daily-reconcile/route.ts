import { NextResponse } from "next/server";
import { runChecks, saveRun } from "@/lib/ledger/daily-reconcile";
import { runDetectors, saveAnomalies } from "@/lib/ledger/anomalies";

export const dynamic = "force-dynamic";

/**
 * Roz ka khud-kar milaan.
 *
 * cPanel Cron Job ise roz ek dafa chalata hai (jaise raat 11 baje, jab
 * din ka kaam khatam ho chuka ho):
 *   curl "https://alranatraders.pk/api/cron/daily-reconcile?token=YOUR_SECRET"
 *
 * Jaanch chalti hai chahe nateeja kuch bhi ho -- sabz nateeja bhi darj
 * hota hai. Sirf masle wale din likhein to ye maloom hi nahi rehta ke
 * kis din jaanch hui hi nahi thi, aur khamoshi "sab theek hai" ki tarah
 * parhi jati hai.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await runChecks();
  const saved = await saveRun(run, "cron");

  // Tarteeb wali jaanch bhi isi cron se chalti hai. Alag cron banane se
  // ek aur cheez lagani parti -- aur jo cheez lagani parti hai, wo aksar
  // nahi lagti.
  let anomaliesFound = 0;
  try {
    const scan = await runDetectors();
    anomaliesFound = await saveAnomalies(scan.found);
  } catch {
    // Detector toot jaye to roz ka milaan phir bhi darj hona chahiye --
    // wo zyada bunyadi cheez hai.
  }

  if ("error" in saved) {
    // Aaj ki jaanch pehle ho chuki ho to ye kharabi nahi -- cron do
    // dafa chal gaya. Nateeja phir bhi wapas bhejte hain taake dekhne
    // wale ko haalat maloom ho.
    return NextResponse.json({
      ok: true,
      saved: false,
      note: saved.error,
      verdict: run.verdict,
      summary: run.summary,
      anomalies: anomaliesFound,
    });
  }

  return NextResponse.json({
    ok: true,
    saved: true,
    verdict: run.verdict,
    summary: run.summary,
    passed: run.passed,
    failed: run.failed,
    skipped: run.skipped,
    anomalies: anomaliesFound,
  });
}
