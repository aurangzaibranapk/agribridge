export const KG_PER_MAUND = 40;

export type GrainRateUnit = "per_maund" | "per_kg" | "legacy_as_stored";

export function normalizeGrainRateUnit(value: string | null | undefined): GrainRateUnit {
  if (value === "per_kg" || value === "per_maund" || value === "legacy_as_stored") return value;
  return "legacy_as_stored";
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Nayi darj: fi mand = kg/40 * rate. Fi kg = kg * rate. Purana total yahan se nahi badalta. */
export function grainAmountFromRate(kg: number, rate: number, unit: GrainRateUnit): number {
  const weight = Number(kg) || 0;
  const price = Number(rate) || 0;
  if (unit === "per_kg") return round2(weight * price);
  return round2((weight / KG_PER_MAUND) * price);
}

export function grainRatePresentation(rate: number, unit: GrainRateUnit): { label: string; perMaund: number; perKg: number; legacy: boolean } {
  const price = Number(rate) || 0;
  if (unit === "per_kg") {
    return { label: "fi kg", perMaund: round2(price * KG_PER_MAUND), perKg: price, legacy: false };
  }
  return {
    label: unit === "legacy_as_stored" ? "fi mand (purani darj, paisa tabdeel nahi)" : "fi mand",
    perMaund: price,
    perKg: round2(price / KG_PER_MAUND),
    legacy: unit === "legacy_as_stored",
  };
}
