/** Ghalti ka chhota hawala (support ke liye) -- koi technical jumla nahi. */
export function errorRef(e: { digest?: string; message?: string } | null | undefined): string {
  const src = e?.digest || e?.message || "";
  if (!src) return "ERR-0000";
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `ERR-${(h >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
}
