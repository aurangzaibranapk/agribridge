/** Bikri khareed se aage nahi. Farq sirf report/diagnostic hai — yahan data nahi mit-ti. */
export function grainSaleWithinBought(boughtKg: number, alreadySoldKg: number, nextKg: number): { ok: true } | { ok: false; error: string } {
  const bought = Number(boughtKg) || 0;
  const sold = Number(alreadySoldKg) || 0;
  const next = Number(nextKg) || 0;
  if (!(next > 0)) return { ok: false, error: "Miqdar sifar se zyada honi chahiye." };
  if (sold + next > bought + 0.001) {
    return {
      ok: false,
      error: `Anaj ki bikri khareed se aage nahi ja sakti. Khareed ${bought} kg, pehle biki ${sold} kg, ab ${next} kg.`,
    };
  }
  return { ok: true };
}

export function sumKg(rows: { kg: number }[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.kg) || 0), 0);
}
