"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { requireMoneyAdmin } from "@/lib/access/money-gate";
import { rpcError } from "@/lib/dairy/rules";

export interface DispatchState {
  error?: string;
  success?: boolean;
  notice?: string;
}

/**
 * Chiller se company tak doodh ki rawangi.
 *
 * Doodh ka safar teen qadam ka hai: kisan -> gaari -> chiller ->
 * COMPANY. Pehle do pehle se darj hote the; teesra kahin nahi hota tha.
 *
 * Aur wohi sab se ahem hai: kamai us adad par hai jo COMPANY ne mana ke
 * usay mila (fi litre service rate). Chiller kahe 1,000 gaye aur company
 * kahe 950 aaye, to wo 50 litre seedha nafe se jate hain.
 */
export async function recordDispatch(_prev: DispatchState, formData: FormData): Promise<DispatchState> {
  const supabase = createClient();
  const gate = await requireAction("milk-collection.dispatch", "create");
  if ("error" in gate) return { error: gate.error };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const branchId = String(formData.get("branch_id") ?? "");
  const date = String(formData.get("dispatch_date") ?? "") || aajKaKhana();
  const shift = String(formData.get("shift") ?? "morning");
  const liters = Number(formData.get("dispatched_liters") ?? 0);

  if (!branchId) return { error: "Kaun sa chiller, wo chunein." };
  if (!liters || liters <= 0) return { error: "Kitne litre gaye, wo likhein." };

  const { error } = await supabase.from("milk_dispatches").insert({
    branch_id: branchId,
    dispatch_date: date,
    shift,
    dispatched_liters: liters,
    vehicle_name: (formData.get("vehicle_name") as string) || null,
    driver_name: (formData.get("driver_name") as string) || null,
    fat_percentage: formData.get("fat_percentage") ? Number(formData.get("fat_percentage")) : null,
    snf_percentage: formData.get("snf_percentage") ? Number(formData.get("snf_percentage")) : null,
    notes: (formData.get("notes") as string) || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    if (/milk_dispatch_one_/.test(error.message)) {
      return { error: "Is chiller ki is shift ki company rawangi pehle se darj hai. Vendor aur party ka slip Handover par alag hai." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/milk-collection/dispatch");
  return { success: true, notice: "Rawangi darj ho gayi. Company ki raseed aane par yahan wapas aayein." };
}

/**
 * Company ne kitna mana.
 *
 * Ye alag amal hai, aur jaan boojh kar: gaari nikal chuki hoti hai aur
 * raseed ghanton ya agle din aati hai. Dono ko ek sath likhwana ka matlab
 * hota ke rawangi tab tak darj hi na ho jab tak raseed na aa jaye -- aur
 * phir gaari nikalne ka koi record hi na hota.
 *
 * Kami ka hisaab yahan NAHI hota -- wo database khud karta hai (135).
 */
export async function recordReceipt(_prev: DispatchState, formData: FormData): Promise<DispatchState> {
  const supabase = createClient();
  const gate = await requireAction("milk-collection.dispatch", "edit");
  if ("error" in gate) return { error: gate.error };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = String(formData.get("dispatch_id") ?? "");
  const received = Number(formData.get("received_liters") ?? 0);

  if (!id) return { error: "Kaun si rawangi, wo saaf nahi." };
  if (!formData.get("received_liters")) return { error: "Company ne kitna mana, wo likhein." };
  if (received < 0) return { error: "Adad manfi nahi ho sakta." };

  const { data: row } = await supabase
    .from("milk_dispatches")
    .select("dispatched_liters, received_liters")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Ye rawangi nahi mili." };
  if (row.received_liters !== null) return { error: "Is par raseed pehle hi darj ho chuki hai." };

  // Bheje se zyada aa jana mumkin nahi. Aisa adad likha jaye to wo
  // ghalti hai -- aur us par chup rehna us kami ko chhupa deta hai jo
  // kisi aur din hui thi.
  if (received > Number(row.dispatched_liters)) {
    return { error: "Company bheje hue se zyada nahi maan sakti. Adad dobara dekh lein." };
  }

  const { error } = await supabase
    .from("milk_dispatches")
    .update({
      received_liters: received,
      received_at: new Date().toISOString(),
      received_by: user?.id ?? null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/milk-collection/dispatch");
  revalidatePath("/admin/milk-collection/handover");
  return { success: true };
}

/**
 * Ghalat raseed Owner theek kare — jis ne khud likhi, wo nahi.
 * Database maker-checker rakhti hai; yahan role pehle roka jata hai.
 */
export async function correctMilkReceipt(_prev: DispatchState, formData: FormData): Promise<DispatchState> {
  const gate = await requireMoneyAdmin("Company ki raseed theek karna");
  if (!gate.ok) return { error: gate.error };
  if (gate.role !== "owner" && gate.role !== "super_admin") {
    return { error: "Raseed sirf Owner theek kar sakta hai." };
  }

  const id = String(formData.get("dispatch_id") ?? "");
  const receivedRaw = formData.get("received_liters");
  const received = Number(receivedRaw ?? 0);
  const note = String(formData.get("note") ?? "").trim();
  if (!id) return { error: "Kaun si rawangi, wo saaf nahi." };
  if (receivedRaw === null || receivedRaw === "" || Number.isNaN(received) || received < 0) {
    return { error: "Company ka adad sahi likhein." };
  }
  if (note.length < 5) return { error: "Raseed theek karne ki wajah kam az kam 5 haroof ki likhein." };

  const posted = await (createServiceClient() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  }).rpc("fn_correct_milk_receipt", {
    p_dispatch: id,
    p_received: received,
    p_by: gate.userId,
    p_note: note,
  });
  if (posted.error) return { error: rpcError(posted.error.message) };

  revalidatePath("/admin/milk-collection/dispatch");
  revalidatePath("/admin/milk-collection/handover");
  return { success: true, notice: "Raseed theek ho gayi." };
}
