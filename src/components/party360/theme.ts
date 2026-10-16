/** Party 360 theme tokens (pure; test: npm run test:party-360). */
export const ACCENT: Record<"farmer" | "customer" | "dealer" | "supplier" | "buyer", [string, string]> = {
  farmer: ["#059669", "#047857"], customer: ["#2563EB", "#1D4ED8"], dealer: ["#7C3AED", "#6D28D9"],
  supplier: ["#EA580C", "#C2410C"], buyer: ["#D97706", "#B45309"],
};
export const short = (n: number) => n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n));
export function kpiIcon(label: string): "rs" | "box" | "scale" | "up" | "down" | "clock" | "cash" | "leaf" | "user" {
  const l = label.toLowerCase();
  if (/hum ne dena|payable/.test(l)) return "down";
  if (/unhon ne dena|munafa|rate/.test(l)) return "up";
  if (/baqaya|akhri|purana|aging/.test(l)) return "clock";
  if (/wasool|payment|paisa|diya/.test(l)) return "cash";
  if (/fasal|doodh/.test(l)) return "leaf";
  if (/wazan|net|kg/.test(l)) return "scale";
  if (/dukan|order|bill|grn/.test(l)) return "box";
  return "rs";
}
/** Sirf 'dark' saved ho to dark; warna hamesha light (default). */
export function resolveTheme(stored: string | null | undefined): "light" | "dark" { return stored === "dark" ? "dark" : "light"; }
