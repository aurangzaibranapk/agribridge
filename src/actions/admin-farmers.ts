"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { alreadyRegisteredMessage, findFarmerByPhone } from "@/lib/farmers/identity";
import { postFarmerLedger } from "@/lib/farmer-ledger";
import { postFarmerCreditGiven, postFarmerCreditRepaid, failed } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function adminAddFarmer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Naam zaroori hai." };

  const phoneNumber = (formData.get("mobile") as string) || null;
  const village = (formData.get("village") as string) || null;
  const district = (formData.get("district") as string) || null;
  const cnic = (formData.get("cnic") as string) || null;

  // Ye safha wo ek darwaza tha jahan ye sawal poochha hi nahi jata tha.
  // Nateeja: daftar mein baitha banda usi kisan ka doosra khata bana deta
  // tha jo counter par pehle se ban chuka hai.
  const already = await findFarmerByPhone(supabase, phoneNumber);
  if (already) return { error: alreadyRegisteredMessage(already) };

  // Code database khud bharta hai (migration 121). Pehle yahan count(*)
  // + 1 tha -- wo us din tootta jis din ek kisan bhi hataya jaye: ginti
  // ek kam ho jati aur agla code kisi purane se takra jata.
  const { data: newFarmer, error } = await supabase
    .from("farmers")
    .insert({
      full_name: fullName,
      phone_number: phoneNumber,
      village,
      district,
      cnic,
      // is_verified yahan se hata diya gaya. Pehle har naye kisan par
      // "Verified" ka thappa usi lamhe lag jata tha jis lamhe naam likha
      // gaya -- aur isi fehrist par maujood "Verify" ka button bemani ho
      // jata tha. Tasdeeq ka matlab hai kisi ne kaghaz dekha; naam likhna
      // tasdeeq nahi.
      registration_source: "STAFF",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Opening balance: malik (13 September) purane kisan add karte waqt
  // un ka pehle se lena/dena bhi wahin likhna chahte hain -- warna kisan
  // to ban jata hai, magar us ka hisaab kahin darj nahi hota aur "Kisan
  // ki Adaigi" jaisi fehristein usay khali samajh kar dikhati hi nahi
  // (wo sifar-activity walon ko chhupati hain, jaan boojh kar). Yahi
  // raasta jo migrateOpeningBalance (farmer-credit.ts) istemal karta
  // hai -- ek hi qadam mein, taake nayi qatar kabhi bina hisaab ke na bane.
  const openingRaw = String(formData.get("opening_balance") ?? "").trim();
  const openingAmount = openingRaw ? Number(openingRaw) : 0;
  if (openingAmount && Number.isFinite(openingAmount)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ledger = await postFarmerLedger({
      farmerId: newFarmer.id,
      sourceType: "opening_balance",
      ledgerType: openingAmount > 0 ? "debit" : "credit",
      amount: Math.abs(openingAmount),
      notes: "Farmer add karte waqt Opening Balance",
      createdBy: user?.id ?? null,
    });
    if (ledger.error) {
      return { error: `Farmer ban gaya magar opening balance darj nahi hua: ${ledger.error}` };
    }
    const claims = ledger.id ? [{ table: "farmer_credit_ledger", rowId: ledger.id }] : [];
    const posted =
      openingAmount > 0
        ? await postFarmerCreditGiven({
            farmerId: newFarmer.id,
            amount: Math.abs(openingAmount),
            sourceType: "opening_balance",
            description: `Opening balance — kisan se lena Rs ${Math.abs(openingAmount).toLocaleString()}`,
            ctx: { createdBy: user?.id ?? null, claims },
          })
        : await postFarmerCreditRepaid({
            farmerId: newFarmer.id,
            amount: Math.abs(openingAmount),
            settledBy: "3200",
            description: `Opening balance — kisan ko dena Rs ${Math.abs(openingAmount).toLocaleString()}`,
            ctx: { createdBy: user?.id ?? null, claims },
          });
    if (failed(posted)) {
      return { error: `Farmer ban gaya magar opening balance ledger mein nahi gaya: ${posted.error}` };
    }
  }

  revalidatePath("/admin/farmers");
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}