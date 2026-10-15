export const DEMAND_CATEGORIES = ["wanda", "khal", "chowker", "moomni", "seed", "pesticide", "fertilizer", "micronutrient"] as const;
export type DemandCategory = (typeof DEMAND_CATEGORIES)[number];
export const DEMAND_CATEGORY_LABELS: Record<DemandCategory, { rm: string; ur: string }> = {
  wanda: { rm: "Wanda", ur: "ونڈا" },
  khal: { rm: "Khal", ur: "کھل" },
  chowker: { rm: "Chowker", ur: "چوکر" },
  moomni: { rm: "Moomni", ur: "مومنی" },
  seed: { rm: "Beej (Seed)", ur: "بیج" },
  pesticide: { rm: "Spray / Pesticide", ur: "زرعی دوا" },
  fertilizer: { rm: "Khaad (Fertilizer)", ur: "کھاد" },
  micronutrient: { rm: "Micronutrient", ur: "مائیکرو نیوٹرینٹ" },
};
export function isDemandCategory(v: unknown): v is DemandCategory {
  return typeof v === "string" && (DEMAND_CATEGORIES as readonly string[]).includes(v);
}
