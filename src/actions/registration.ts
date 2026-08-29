"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface RegisterState {
  error?: string;
  success?: boolean;
}

// nextFarmerCode hata diya gaya.
//
// Farmer code ab database khud bharta hai (migration 121): ek counter,
// ek trigger. Pehle ye kaam teen jagah teen tareeqon se hota tha, aur
// do log ek hi lamhe mein kisan banayen to dono ko ek hi number mil
// jata tha -- kyunki dono ne ek hi purana code parh kar us mein 1 jora
// tha.

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

// Registration form (see src/app/register/farmer/page.tsx) is exactly
// five fields, in this order: Full Name, Mobile Number, Email, Password,
// District. Password is deliberately simple (6+ characters, digits are
// fine, no uppercase/lowercase requirement) since most farmers will use
// a simple numeric PIN they can remember. Everything else — Village,
// CNIC, farming details, and documents — is filled in later from the
// Farmer Portal profile page.
export async function registerFarmer(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneNumber = normalizePhone(String(formData.get("phone_number") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const district = String(formData.get("district") ?? "").trim();

  if (!fullName) return { error: "Please enter your name." };
  if (phoneNumber.length < 10) return { error: "Please enter a valid mobile number." };
  if (!email) return { error: "Please enter your email address." };
  if (!district) return { error: "Please enter your district." };
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const [{ data: phoneMatch }, { data: emailMatch }] = await Promise.all([
    serviceClient.from("farmers").select("id").eq("phone_number", phoneNumber).maybeSingle(),
    serviceClient.from("farmers").select("id").eq("email", email).maybeSingle(),
  ]);
  if (phoneMatch) return { error: "A farmer with this mobile number is already registered." };
  if (emailMatch) return { error: "A farmer with this email is already registered." };

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone_number: phoneNumber, role: "farmer" } },
  });

  if (signUpError) return { error: signUpError.message };
  if (!signUpData.user) return { error: "Could not create account. Please try again." };

  await serviceClient.auth.admin.updateUserById(signUpData.user.id, { email_confirm: true });

  const { error: farmerError } = await serviceClient.from("farmers").insert({
    user_id: signUpData.user.id,
    full_name: fullName,
    phone_number: phoneNumber,
    email,
    district,
  });

  if (farmerError) {
    if (farmerError.message.includes("farmers_phone_number_key")) return { error: "A farmer with this mobile number is already registered." };
    if (farmerError.message.includes("farmers_email_key")) return { error: "A farmer with this email is already registered." };
    return { error: farmerError.message };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "Account created, but automatic sign-in failed. Please sign in manually." };

  return { success: true };
}