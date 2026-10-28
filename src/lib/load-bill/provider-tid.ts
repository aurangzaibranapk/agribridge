/**
 * Load, bill (BP), aur bank transfer darj karte waqt provider ki
 * transaction ID. Khali TID pehle `saboot_baqi` bana deti thi, aur
 * My Work par "Load proof missing" (LD- / BP-) aa jati thi.
 *
 * Nayi entry par ye ID lazmi hai. Purani `saboot_baqi` qataron par
 * baad mein lagane wala raasta (`attachProviderTid`) alag hai.
 */
export const PROVIDER_TID_MIN = 3;

export function providerTidForEntry(
  raw: FormDataEntryValue | null,
  kind: "load" | "bill" | "bank",
): { tid: string } | { error: string } {
  const tid = String(raw ?? "").trim();
  const what = kind === "bill" ? "Bill" : kind === "bank" ? "Bank transfer" : "Load";
  if (!tid) {
    return {
      error: `${what} ki transaction ID (Trex / Tx ID) lazmi hai. Bina is ke darj nahi hota.`,
    };
  }
  if (tid.length < PROVIDER_TID_MIN) {
    return {
      error: `${what} ki transaction ID (Trex / Tx ID) mukammal likhein.`,
    };
  }
  return { tid };
}
