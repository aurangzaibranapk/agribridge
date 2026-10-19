/** Wohi format jo purane Command Center ka `rs()` hai. */
export function formatRs(value: number | null): string {
  if (value == null) return "—";
  return `Rs ${Math.round(value).toLocaleString()}`;
}
