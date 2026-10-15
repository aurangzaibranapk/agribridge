export type DemandPriority = "High" | "Medium" | "Low";

/** Kisanon ki ginti zyada wazan rakhti hai, miqdar doosre number par. */
export function demandScore(farmers: number, quantity: number) {
  return farmers * 10 + Math.min(quantity, 1000) / 5;
}
export function demandPriority(farmers: number, quantity: number): DemandPriority {
  if (farmers >= 10 || quantity >= 200 || (farmers >= 5 && quantity >= 100)) return "High";
  if (farmers >= 3 || quantity >= 50) return "Medium";
  return "Low";
}

/** Kharid ka mashwara: confirmed miqdar + buffer (10%, kam az kam 1), poore adad mein. */
export function procurementSuggestion(confirmedQty: number, bufferPct = 10) {
  const confirmed = Math.max(0, Math.round(confirmedQty * 1000) / 1000);
  const buffer = confirmed > 0 ? Math.max(1, Math.ceil((confirmed * bufferPct) / 100)) : 0;
  return { confirmed, buffer, suggested: Math.ceil(confirmed + buffer) };
}

export function areaOf(f: { village?: string | null; tehsil?: string | null; district?: string | null } | null, demandArea?: string | null) {
  const v = (f?.village || "").trim();
  const t = (f?.tehsil || "").trim();
  const d = (f?.district || "").trim();
  const fromFarmer = [v, t || d].filter(Boolean).join(", ");
  return fromFarmer || (demandArea || "").trim() || "Na-maloom ilaqa";
}
