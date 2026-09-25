"use server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * RLS ke peeche se customer naam -- browser client customers table
 * nahi dekh sakta (staff ke liye policy band hai), isliye service
 * client se fetch hota hai.
 */
export async function fetchPosCustomerNames(
  crmIds: string[]
): Promise<Map<string, { name: string; phone_number: string | null; cnic: string | null }>> {
  if (!crmIds.length) return new Map();
  const service = createServiceClient();
  const { data } = await service
    .from("customers")
    .select("id, name, phone_number, cnic")
    .in("id", crmIds);
  return new Map((data ?? []).map((c) => [c.id, { name: c.name ?? "—", phone_number: c.phone_number ?? null, cnic: c.cnic ?? null }]));
}
