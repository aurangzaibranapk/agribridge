export function grainBagWeight(grainType: string): number | null {
  return grainType === "rice" ? 60 : grainType === "wheat" ? 100 : null;
}
const round = (value: number, places: number) => Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places;
export function grainBagCalculation(input: {
  grainType: string; grossKg: number; ratePerMaund: number;
  bagWeightKg?: number | null;
  cutBasis: "per_bag" | "total_weight" | "percentage";
  cutKg: number; cutGrams: number; cutPercentage?: number;
  chungiBasis: "per_bag" | "total"; chungiType: "cash" | "grain"; chungiValue: number;
}) {
  const configuredBag = input.bagWeightKg === undefined ? grainBagWeight(input.grainType) : input.bagWeightKg;
  const bagKg = configuredBag && Number.isFinite(configuredBag) && configuredBag > 0 ? configuredBag : null;
  const bags = bagKg ? input.grossKg / bagKg : 0;
  const errors: string[] = [];
  for (const value of [input.grossKg,input.ratePerMaund,input.cutKg,input.cutGrams,input.chungiValue,input.cutPercentage ?? 0]) {
    if (!Number.isFinite(value) || value < 0) errors.push("Weight, cut, rate aur chungi positive numbers mein likhein.");
  }
  if ((input.cutBasis === "per_bag" || input.chungiBasis === "per_bag") && !bagKg) errors.push("Is grain ke liye bori weight set nahi hai; total weight/amount use karein.");
  if (input.cutGrams >= 1000) errors.push("Gram 0-999 mein likhein; 1000 gram = 1kg.");
  const unitCutKg = input.cutKg + input.cutGrams / 1000;
  const cutKg = round(input.cutBasis === "percentage" ? input.grossKg * (input.cutPercentage ?? 0) / 100 : unitCutKg * (input.cutBasis === "per_bag" ? bags : 1),3);
  if (cutKg > input.grossKg) errors.push("Cut gross weight se zyada nahi ho sakta.");
  const netKg = round(input.grossKg - cutKg,3);
  const total = round(netKg / 40 * input.ratePerMaund,2);
  const chungiUnits = input.chungiValue * (input.chungiBasis === "per_bag" ? bags : 1);
  const chungiKg = input.chungiType === "grain" ? round(chungiUnits,3) : 0;
  const chungiAmount = round(input.chungiType === "grain" ? chungiKg / 40 * input.ratePerMaund : chungiUnits,2);
  if (chungiAmount > total) errors.push("Chungi grain value se zyada nahi ho sakti.");
  return { bagKg, bags, fullBags: bagKg ? Math.floor(bags) : 0, remainingKg: bagKg ? round(input.grossKg % bagKg,3) : 0,
    unitCutKg, cutKg, cutPercentage: input.grossKg > 0 ? cutKg / input.grossKg * 100 : 0,
    netKg, total, chungiKg, chungiAmount, payable: round(total - chungiAmount,2), errors };
}

export function grainKgGrams(kg: number): string {
  const grams = Math.round(kg * 1000);
  return `${Math.floor(grams / 1000).toLocaleString()} kg ${grams % 1000} gram`;
}
