"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { alreadyRegisteredMessage, findFarmerByPhone } from "@/lib/farmers/identity";

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

  // Number ki asal par sawal, harf-ba-harf nahi: 0300-1234567 aur
  // +923001234567 ek hi banda hai (migration 124).
  const [phoneMatch, { data: emailMatch }] = await Promise.all([
    findFarmerByPhone(serviceClient, phoneNumber),
    serviceClient.from("farmers").select("id").eq("email", email).maybeSingle(),
  ]);
  if (phoneMatch) return { error: alreadyRegisteredMessage(phoneMatch) };
  if (emailMatch) return { error: "A farmer with this email is already registered." };

  // `supabase.auth.signUp()` (client-side) makes Supabase's own mailer
  // try to send a confirmation email as PART of the signup call -- and
  // if that mailer fails (default Supabase email has a tight quota),
  // the whole signup fails with "Error sending confirmation email" and
  // NO user is created at all. We immediately force-confirm the email
  // right after anyway (line below, previously), so that mailer attempt
  // was pure dead weight -- it could only make signup fail, never help.
  // `admin.createUser` (service role) skips it entirely: no email is
  // sent, the account is created pre-confirmed in one step. Same
  // pattern already used for WhatsApp-OTP farmer signups (farmer-auth.ts).
  const { data: createData, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone_number: phoneNumber, role: "farmer" },
  });

  if (createError) return { error: createError.message };
  if (!createData.user) return { error: "Could not create account. Please try again." };

  const { error: farmerError } = await serviceClient.from("farmers").insert({
    user_id: createData.user.id,
    full_name: fullName,
    phone_number: phoneNumber,
    email,
    district,
    registration_source: "SELF",
  });

  if (farmerError) {
    // Pehra ab phone_key par hai (aakhri das hindse), purane
    // farmers_phone_number_key par nahi -- wo migration 124 mein hata
    // diya gaya, kyunke wo ek hi number ke teen andaz alag samajhta tha.
    if (farmerError.message.includes("farmers_phone_key_uniq")) return { error: "A farmer with this mobile number is already registered." };
    if (farmerError.message.includes("farmers_email_key")) return { error: "A farmer with this email is already registered." };
    return { error: farmerError.message };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "Account created, but automatic sign-in failed. Please sign in manually." };

  return { success: true };
}