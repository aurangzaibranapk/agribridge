"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";
import { logAudit } from "@/lib/audit";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export interface ActionState {
  error?: string;
  success?: boolean;
}

/**
 * Purana baqaya (purane DigiKhata se) — Edit/Add Customer form ke andar
 * hi ek khana.
 *
 * Malik (18 September): bulk import (`customer-import.ts`, `/admin/crm/
 * import`) sirf NAYE customer ke liye tha. Ek maujood customer (jaise
 * Amir Sultan) ke liye bhi yehi zaroorat padi -- alag safha kholne ke
 * bajaye isi Edit Customer form mein ek khana.
 *
 * Ye khana kisi column se JUdA NAHI -- form hamesha khali khulta hai,
 * kabhi database se wapas nahi bharta. Isi liye "Save Changes" dobara
 * dabane par purani raqam dobara ledger mein nahi chaRhti: jab tak
 * banda khud dobara koi adad na likhe, ye khana khamosh rehta hai.
 * Bilkul wohi ledger tareeqa jo import flow mein hai -- 1100 (Customer
 * se lena) "Malik ka sarmaya" (3200, ACC.openingEquity) ke against.
 */
async function postOpeningAdjustment(
  formData: FormData,
  customerId: string,
  customerName: string,
  userId: string
): Promise<{ error?: string }> {
  const raw = String(formData.get("purana_baqaya") ?? "").trim();
  if (!raw) return {};
  const amount = Math.round(Number(raw) * 100) / 100;
  if (!Number.isFinite(amount) || amount === 0) return {};

  const service = createServiceClient();
  const tafseel = `Purana baqaya (purane khata se) — ${customerName}`;
  const abs = Math.abs(amount);
  const lena = amount > 0;

  const posted = await postJournal({
    description: tafseel,
    sourceModule: "customer_opening_adjustment",
    sourceId: customerId,
    branchId: null,
    createdBy: userId,
    lines: lena
      ? [
          { account: ACC.customerDue, debit: abs, partyType: "customer", partyId: customerId, memo: tafseel },
          { account: ACC.openingEquity, credit: abs, memo: tafseel },
        ]
      : [
          { account: ACC.openingEquity, debit: abs, memo: tafseel },
          { account: ACC.customerDue, credit: abs, partyType: "customer", partyId: customerId, memo: tafseel },
        ],
  });
  if ("error" in posted) return { error: `Purana baqaya ledger mein darj nahi ho saka: ${posted.error}` };

  const { data: cust } = await service.from("customers").select("current_balance").eq("id", customerId).maybeSingle();
  const abTak = cust?.current_balance == null ? 0 : Number(cust.current_balance);
  await service
    .from("customers")
    .update({ current_balance: Math.round((abTak + amount) * 100) / 100 })
    .eq("id", customerId);

  await logAudit({
    actionType: "create",
    module: "crm",
    recordId: customerId,
    recordLabel: customerName,
    description: `Purana baqaya darj hua: ${customerName} — Rs ${abs.toLocaleString()} (${lena ? "lena hai" : "credit/advance"})`,
  });

  return {};
}

export async function saveCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phone_number") ?? "").trim();

  if (!name) return { error: "Customer name is required." };
  if (!phoneNumber) return { error: "Phone number is required." };

  const payload = {
    name,
    contact_person: (formData.get("contact_person") as string) || null,
    phone_number: phoneNumber,
    cnic: (formData.get("cnic") as string)?.trim() || null,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    // Malik ka usool (customer-udhaar.ts mein bhi likha hai): khali
    // chhoRna "hadd tay hi nahi hui" hai, "hadd sifar hai" nahi. Pehle
    // yahan khali khana 0 ban jata tha -- is se har naye customer ki
    // udhaar hamesha ke liye band ho jati thi, bina kisi ke faisla
    // kiye (18 September, Muhammad Akhtar ke saath yehi hua).
    credit_limit: formData.get("credit_limit") ? Number(formData.get("credit_limit")) : null,
    payment_due_days: formData.get("payment_due_days") ? Number(formData.get("payment_due_days")) : 0,
    // Thok wali dukan par POS khud thok ka rate lagata hai (246). Ye
    // darja gahak par ek dafa likha jata hai, har bill par nahi chuna
    // jata -- warna rate counter wale ki marzi par aa jata.
    customer_type:
      formData.get("customer_type") === "wholesale_shop" ? "wholesale_shop" : "retail",
    // Malik (19 September): "wholesale ke liye Shop ka naam bhi add ho,
    // wahi POS mein aana chahiye." Retail customer ke liye maani nahi
    // rakhta -- checkbox utarne par khali kar dete hain.
    business_name:
      formData.get("customer_type") === "wholesale_shop"
        ? (formData.get("business_name") as string)?.trim() || null
        : null,
  };

  const { data: created, error } = await supabase.from("customers").insert(payload).select("id").single();
  if (error) return { error: error.message };

  const raw = String(formData.get("purana_baqaya") ?? "").trim();
  if (raw) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: me } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    if (!me || !UNRESTRICTED_ROLES.includes(me.role)) {
      return { error: "Customer ban gaya, magar purana baqaya darj karna sirf Manager/Admin/Owner ka kaam hai." };
    }
    const adj = await postOpeningAdjustment(formData, created.id, name, user!.id);
    if (adj.error) return { error: `Customer ban gaya, magar ${adj.error}` };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}

export async function updateCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing customer id." };

  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phone_number") ?? "").trim();

  if (!name) return { error: "Customer name is required." };
  if (!phoneNumber) return { error: "Phone number is required." };

  const payload = {
    name,
    contact_person: (formData.get("contact_person") as string) || null,
    phone_number: phoneNumber,
    cnic: (formData.get("cnic") as string)?.trim() || null,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    credit_limit: formData.get("credit_limit") ? Number(formData.get("credit_limit")) : null,
    payment_due_days: formData.get("payment_due_days") ? Number(formData.get("payment_due_days")) : 0,
    // Thok wali dukan par POS khud thok ka rate lagata hai (246). Ye
    // darja gahak par ek dafa likha jata hai, har bill par nahi chuna
    // jata -- warna rate counter wale ki marzi par aa jata.
    customer_type:
      formData.get("customer_type") === "wholesale_shop" ? "wholesale_shop" : "retail",
    business_name:
      formData.get("customer_type") === "wholesale_shop"
        ? (formData.get("business_name") as string)?.trim() || null
        : null,
  };

  const { error } = await supabase.from("customers").update(payload).eq("id", id);
  if (error) return { error: error.message };

  const raw = String(formData.get("purana_baqaya") ?? "").trim();
  if (raw) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: me } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    if (!me || !UNRESTRICTED_ROLES.includes(me.role)) {
      return { error: "Baqi tabdeeliyan ho gayin, magar purana baqaya darj karna sirf Manager/Admin/Owner ka kaam hai." };
    }
    const adj = await postOpeningAdjustment(formData, id, name, user!.id);
    if (adj.error) return { error: adj.error };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}