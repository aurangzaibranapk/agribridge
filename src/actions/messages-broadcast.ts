"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { departmentForRole, departmentByKey } from "@/lib/departments";

export interface ActionState {
  error?: string;
  success?: boolean;
  /** Kitnon tak gaya -- panel isay dikhata hai. */
  sent?: number;
}

const MASTER = ["owner", "super_admin", "admin", "manager"];

const STAFF_ROLES = [
  "owner", "super_admin", "admin", "manager", "sales_staff", "finance",
  "warehouse", "admin_assistant", "hr", "procurement", "milk_collection", "machinery", "ai_assistant",
];

/**
 * Ek se ziyada bandon ko paighaam: poore idare ko elaan, ya ek department ko.
 *
 * Pehle ye kaam bina kisi rok ke tha -- koi bhi login kiya hua banda
 * "Sab Staff Ko Bhejein" dabata to paighaam poore idare mein chala jata.
 * Malik ka faisla (3 September): elaan sirf Owner/Admin/Manager ka kaam
 * hai, aur bhejne se pehle ginti saamne aani chahiye.
 *
 * Har elaan ka apna record bhi banta hai (staff_message_broadcasts).
 * staff_messages mein to 19 alag qatarein banti hain; un se ye pata nahi
 * chalta ke wo dar-asal EK elaan tha, kis ne bheja aur kitnon ko.
 */
export async function sendBroadcastMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: me } = await serviceClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) return { error: "Account fa'aal nahi." };

  const deptKey = String(formData.get("department_key") ?? "").trim();
  const scope: "all" | "department" = deptKey ? "department" : "all";

  if (scope === "all" && !MASTER.includes(me.role)) {
    return { error: "Sab ko elaan sirf Owner/Admin/Manager bhej sakte hain." };
  }
  if (scope === "department") {
    const dept = departmentByKey(deptKey);
    if (!dept) return { error: "Ye department nahi mila." };
    const mine = departmentForRole(me.role);
    if (!MASTER.includes(me.role) && mine?.key !== dept.key) {
      return { error: "Sirf apne department ko paighaam bhej sakte hain." };
    }
  }

  const message = String(formData.get("message") ?? "").trim();

  let attachmentUrl: string | null = null;
  let attachmentType: string | null = null;
  const attachment = formData.get("attachment");
  if (attachment instanceof File && attachment.size > 0) {
    const path = `${user.id}/${Date.now()}-${attachment.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("staff-messages").upload(path, attachment);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("staff-messages").getPublicUrl(path);
      attachmentUrl = data.publicUrl;
      attachmentType = attachment.type.startsWith("image/") ? "image" : "file";
    }
  }

  if (!message && !attachmentUrl) return { error: "Message ya file chahiye." };

  const { data: staff } = await serviceClient
    .from("profiles")
    .select("id, role")
    .in("role", STAFF_ROLES)
    .eq("is_active", true)
    .neq("id", user.id);

  const recipients = (staff ?? []).filter((r) =>
    scope === "all" ? true : departmentForRole(r.role)?.key === deptKey
  );

  if (recipients.length === 0) {
    // Sifar aur "hisaab nahi rakha jata" ek cheez nahi -- yahan waqai
    // koi wusool karne wala nahi hai, aur yehi batana chahiye.
    return { error: "Is department mein abhi koi fa'aal mulazim nahi." };
  }

  const rows = recipients.map((r) => ({
    sender_id: user.id,
    recipient_id: r.id,
    message: message || null,
    attachment_url: attachmentUrl,
    attachment_type: attachmentType,
  }));
  const { error: insertError } = await serviceClient.from("staff_messages").insert(rows);
  if (insertError) return { error: "Paighaam mehfooz nahi hua. Dobara koshish karein." };

  await serviceClient.from("staff_message_broadcasts" as never).insert({
    sender_id: user.id,
    scope,
    department_key: scope === "department" ? deptKey : null,
    recipient_count: recipients.length,
    message: message || null,
    attachment_url: attachmentUrl,
  } as never);

  revalidatePath("/admin/messages");
  return { success: true, sent: recipients.length };
}
