/**
 * Grain "Pending (Admin approval)" entry ka payload.
 *
 * Pending entry form ki tamam khaane (bori, cut, chungi, kharche, payment,
 * notes) waise ke waise jsonb mein rakhti hai. Approve par isi payload se
 * dobara wohi FormData banti hai aur asal posting ka raasta (createGrainEntry)
 * chalta hai -- is liye hisaab ka koi doosra tareeqa nahi banaya gaya.
 */

import { grainBagCalculation } from "@/lib/grain/bag-calculation";

export type GrainPendingPayload = Record<string, string>;

/** Ye khaane payload mein nahi jate (file alag upload hoti hai). */
const SKIP_KEYS = new Set(["receipt_photo", "save_mode"]);

export function grainPayloadFromForm(formData: FormData): GrainPendingPayload {
  const payload: GrainPendingPayload = {};
  formData.forEach((value, key) => {
    if (SKIP_KEYS.has(key) || key.startsWith("$ACTION")) return;
    if (typeof value === "string") payload[key] = value;
  });
  return payload;
}

export function formDataFromGrainPayload(payload: GrainPendingPayload): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (SKIP_KEYS.has(key)) continue;
    if (typeof value === "string") formData.set(key, value);
    else if (typeof value === "number" || typeof value === "boolean") formData.set(key, String(value));
  }
  return formData;
}

export interface GrainPendingExpense {
  category: string;
  description: string;
  amount: number;
  account_id: string;
}

export function grainPendingExpenses(payload: GrainPendingPayload): GrainPendingExpense[] {
  if (payload?.has_expense !== "yes") return [];
  try {
    const rows = JSON.parse(payload.expenses_json ?? "[]");
    return Array.isArray(rows)
      ? rows.map((row) => ({
          category: String(row?.category ?? ""),
          description: String(row?.description ?? ""),
          amount: Number(row?.amount ?? 0),
          account_id: String(row?.account_id ?? ""),
        }))
      : [];
  } catch {
    return [];
  }
}

/** Admin review par jo khaane badle ja sakte hain (bechne wala aur fasal nahi -- wo galat ho to Reject karein). */
export const GRAIN_PENDING_EDITABLE: { key: string; label: string; type: "date" | "number" | "text" }[] = [
  { key: "entry_date", label: "Tareekh (asal din jab maal aaya)", type: "date" },
  { key: "gross_weight_kg", label: "Kul wazan (kg)", type: "number" },
  { key: "rate_per_kg", label: "Rate (Rs fi mand / 40 kg)", type: "number" },
  { key: "bag_weight_kg", label: "1 bori kitne kg", type: "number" },
  { key: "cut_kg_input", label: "Cut kg (fi bori, ya kul agar bori nahi)", type: "number" },
  { key: "cut_grams_input", label: "Cut gram (fi bori, ya kul)", type: "number" },
  { key: "chungi_value", label: "Chungi (kg ya Rs -- jo form par chuna tha)", type: "number" },
  { key: "moisture_percentage", label: "Nami %", type: "number" },
  { key: "quality_grade", label: "Quality grade", type: "text" },
  { key: "payment_amount", label: "Payment ki raqam (agar payment 'Haan' thi)", type: "number" },
  { key: "notes", label: "Notes", type: "text" },
];

export const GRAIN_EXPENSE_LABELS: Record<string, string> = {
  diesel_fuel: "Diesel",
  labor_mazdoori: "Mazdoori",
  bardana: "Bardana (khali bori)",
  tractor_trolley_rent: "Tractor / Trolley kiraya",
  other: "Deegar (silai dhaga waghera)",
};


/** Review safhe ka poora hisaab -- wohi function jo asal posting chalati hai. */
export function grainPendingCalc(payload: GrainPendingPayload) {
  const num = (key: string) => Number(payload?.[key] ?? 0) || 0;
  const cutBasis = (["per_bag", "total_weight", "percentage"].includes(payload?.cut_basis) ? payload.cut_basis : "total_weight") as "per_bag" | "total_weight" | "percentage";
  const chungiBasis = (payload?.chungi_basis === "per_bag" ? "per_bag" : "total") as "per_bag" | "total";
  const chungiType = (payload?.chungi_type === "cash" ? "cash" : "grain") as "cash" | "grain";
  const calc = grainBagCalculation({
    grainType: String(payload?.grain_type ?? ""),
    grossKg: num("gross_weight_kg"),
    ratePerMaund: num("rate_per_kg"),
    cutBasis,
    bagWeightKg: num("bag_weight_kg") || null,
    cutKg: num("cut_kg_input"),
    cutGrams: num("cut_grams_input"),
    cutPercentage: num("preset_cut_percentage"),
    chungiBasis,
    chungiType,
    chungiValue: num("chungi_value"),
  });
  return { ...calc, cutBasis, chungiBasis, chungiType, ratePerMaund: num("rate_per_kg"), grossKg: num("gross_weight_kg") };
}
