/** Mockup jaisi formatting: "Rs 875,687" aur chhota "203K" / "5.85M". */
export function rs(v: number): string {
  return (v < 0 ? "-" : "") + "Rs " + Math.round(Math.abs(v)).toLocaleString("en-US");
}
export function kfmt(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e6) return s + (a / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return s + Math.round(a / 1e3) + "K";
  return s + Math.round(a);
}
export function pct(n: number, d: number, digits = 1): string {
  if (!d) return "0.0%";
  return ((n / d) * 100).toFixed(digits) + "%";
}
