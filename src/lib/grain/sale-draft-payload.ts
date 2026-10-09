/**
 * Grain SALE "Draft (Admin approval)" -- payload wohi form ke khaane hain
 * (pending-payload.ts ke grainPayloadFromForm / formDataFromGrainPayload).
 * Approve par isi se dobara FormData ban kar asal bikri ka raasta chalta hai.
 */

/** Admin review par badle ja sakne wale khaane (buyer/godam/fasal select alag se). */
export const GRAIN_SALE_DRAFT_EDITABLE: { key: string; label: string; type: "date" | "number" | "text" }[] = [
  { key: "sale_date", label: "Bikri ki tareekh (asal din)", type: "date" },
  { key: "quantity_kg", label: "Wazan (kg)", type: "number" },
  { key: "rate_per_kg", label: "Rate (Rs fi kg)", type: "number" },
  { key: "bardana_cost", label: "Bardana kharcha (Rs)", type: "number" },
  { key: "mazdoori_cost", label: "Mazdoori kharcha (Rs)", type: "number" },
  { key: "notes", label: "Notes", type: "text" },
];

export const GRAIN_SALE_DELIVERY_LABELS: Record<string, string> = {
  load_deliver: "Load kar ke diya",
  unload_deliver: "Utaar kar diya",
  buyer_pickup: "Buyer khud le gaya",
  we_deliver: "Hum ne pahunchaya",
};
