type Movement = { id: string; inventory_id: string; movement_type: string; quantity: unknown; reference_type: string | null; reference_id?: string | null; notes: string | null };
export function reversedCorrectionIds(moves: Movement[]) {
  const reversed = new Set<string>();
  for (const original of moves) {
    if (!["data_correction", "manual_adjustment"].includes(original.reference_type ?? "")) continue;
    const opposite = original.movement_type === "adjustment_increase" ? "adjustment_decrease" : "adjustment_increase";
    const evidence = moves.filter(row => row.inventory_id === original.inventory_id && row.movement_type === opposite && row.reference_type?.includes("reversal") && (row.reference_id === original.id || row.notes?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)?.includes(original.id)));
    if (evidence.length && Math.abs(evidence.reduce((sum, row) => sum + Number(row.quantity), 0) - Number(original.quantity)) < 0.000001) reversed.add(original.id);
  }
  return reversed;
}
