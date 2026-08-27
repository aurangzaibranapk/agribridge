export const CROP_DURATIONS: Record<string, number> = {
  "Wheat": 130,
  "Rice": 130,
  "Maize": 100,
  "Cotton": 170,
  "Sugarcane": 330,
  "Potato": 100,
  "Onion": 130,
  "Tomato": 100,
  "Sunflower": 100,
  "Chickpea (Gram)": 110,
};

export const CROP_NAMES = Object.keys(CROP_DURATIONS);

export function calculateHarvestDate(cropName: string, sowingDate: Date): Date {
  const days = CROP_DURATIONS[cropName] ?? 120;
  const harvestDate = new Date(sowingDate);
  harvestDate.setDate(harvestDate.getDate() + days);
  return harvestDate;
}

export function getCropProgress(sowingDate: string, expectedHarvestDate: string) {
  const today = new Date();
  const sowing = new Date(sowingDate);
  const harvest = new Date(expectedHarvestDate);

  const totalDays = Math.max(1, Math.round((harvest.getTime() - sowing.getTime()) / 86400000));
  const daysElapsed = Math.round((today.getTime() - sowing.getTime()) / 86400000);
  const daysRemaining = totalDays - daysElapsed;
  const percent = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));

  return { totalDays, daysElapsed: Math.max(0, daysElapsed), daysRemaining, percent };
}