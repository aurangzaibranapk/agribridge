/** Godam ki ginti. Khareed ka jorh yahan nahi — adjustments aur transfer bhi isi ginti mein hain. */
export function grainSaleWithinOnHand(onHandKg: number, nextKg: number): { ok: true } | { ok: false; error: string } {
  const onHand = Number(onHandKg) || 0;
  const next = Number(nextKg) || 0;
  if (!(next > 0)) return { ok: false, error: "Miqdar sifar se zyada honi chahiye." };
  if (next > onHand + 0.001) {
    return { ok: false, error: `Is godam mein itna anaj nahi. Maujood ${onHand} kg, darkar ${next} kg.` };
  }
  return { ok: true };
}

/** Owner/Admin purani bikri ki miqdar kam kar sakein, chahe godam ab khali ho. Barhana phir bhi stock dekhta hai. */
export function grainSaleEditAllowed(args: {
  role: string | null | undefined;
  oldKg: number;
  newKg: number;
  onHandKg: number;
}): { ok: true } | { ok: false; error: string } {
  const hq = args.role === "owner" || args.role === "super_admin" || args.role === "admin";
  const oldKg = Number(args.oldKg) || 0;
  const newKg = Number(args.newKg) || 0;
  if (hq && newKg <= oldKg) return { ok: true };
  const extra = newKg - oldKg;
  if (extra <= 0) return { ok: true };
  return grainSaleWithinOnHand(args.onHandKg, extra);
}

export function sumKg(rows: { kg: number }[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.kg) || 0), 0);
}
