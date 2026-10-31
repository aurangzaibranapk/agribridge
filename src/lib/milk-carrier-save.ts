import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

export interface CarrierOptionRow {
  id: string;
  name: string;
}

/** Carriers ki list slip ke form ke liye. 734 na ho to khali list aur saaf message. */
export async function loadCarrierOptions(): Promise<{ carriers: CarrierOptionRow[]; error: string | null }> {
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from("milk_carriers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) {
    return { carriers: [], error: "Carrier ki list abhi nahi. Migration 734 pehle Testing par chalao." };
  }
  return { carriers: (data ?? []) as CarrierOptionRow[], error: null };
}

/**
 * Dispatch ko carrier se jorta hai. carrierId ya naya naam. Dono khali ho to
 * kuch nahi karta. Naya naam ho to pehle carrier banta hai. Error ho to string.
 */
export async function attachCarrierToDispatch(
  service: any,
  dispatchId: string,
  carrierId: string,
  newName: string,
  userId: string
): Promise<string | null> {
  if (!carrierId && !newName) return null;
  let resolved = carrierId;
  if (resolved && !UUID.test(resolved)) return "Carrier sahi nahi.";
  if (!resolved) {
    const { data: existing } = await service
      .from("milk_carriers")
      .select("id")
      .ilike("name", newName)
      .eq("is_active", true)
      .maybeSingle();
    if (existing?.id) {
      resolved = existing.id;
    } else {
      const { data: created, error: createErr } = await service
        .from("milk_carriers")
        .insert({ name: newName, kind: "vendor", created_by: userId })
        .select("id")
        .single();
      if (createErr) return `Naya carrier save nahi hua: ${createErr.message}`;
      resolved = created.id;
    }
  }
  const { error } = await service.from("milk_dispatches").update({ carrier_id: resolved }).eq("id", dispatchId);
  if (error) return `Carrier save nahi hua: ${error.message}`;
  return null;
}
