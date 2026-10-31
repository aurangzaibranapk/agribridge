"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";
import { rpcError } from "@/lib/dairy/rules";

const ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];

export interface PartyState {
  error?: string;
  success?: boolean;
}

type PartyRpc = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: { message: string } | null }>;
};

export async function createHandoverPartyRecord(input: {
  userId: string;
  id?: string | null;
  name: string;
  contact: string | null;
  active: boolean;
}): Promise<{ id: string } | { error: string }> {
  const posted = await (createServiceClient() as unknown as PartyRpc).rpc("fn_save_milk_handover_party", {
    p_by: input.userId,
    p_id: input.id || null,
    p_name: input.name,
    p_contact: input.contact,
    p_active: input.active,
  });
  if (posted.error) {
    const message = rpcError(posted.error.message);
    if (/fn_save_milk_handover_party|milk_handover_parties/i.test(message)) {
      return { error: "Party master abhi nahi. Migration 729 pehle Testing par chalao — Live se pehle backup." };
    }
    return { error: message };
  }
  if (!posted.data) return { error: "Party mehfooz nahi hui." };
  return { id: posted.data };
}

export async function saveHandoverParty(_prev: PartyState, formData: FormData): Promise<PartyState> {
  const idRaw = String(formData.get("party_id") ?? "").trim();
  const allowed = await requireAction("milk-collection.handover", idRaw ? "edit" : "create");
  if ("error" in allowed) return { error: allowed.error };
  if (!ROLES.includes(allowed.caller.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };
  if (idRaw && !/^[0-9a-f-]{36}$/i.test(idRaw)) return { error: "Ye party sahi nahi." };

  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "yes";
  const saved = await createHandoverPartyRecord({
    userId: allowed.caller.userId,
    id: idRaw || null,
    name,
    contact: contact || null,
    active,
  });
  if ("error" in saved) return saved;

  await logAudit({
    actionType: idRaw ? "update" : "create",
    module: "milk_handover_parties",
    recordId: saved.id,
    recordLabel: name,
    description: `Handover party — ${name}${active ? "" : " (band)"}`,
  });

  revalidatePath("/admin/milk-collection/handover/parties");
  revalidatePath("/admin/milk-collection/handover/party");
  return { success: true };
}
