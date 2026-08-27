"use server";

import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  success?: boolean;
}

export async function submitContactMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !message) return { error: "Please fill in your name and message." };

  const { error } = await supabase.from("contact_messages").insert({
    name,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    message,
  });

  if (error) return { error: "Something went wrong. Please try again or use the details on the Contact page." };
  // Staff notification: a real email/SMS alert requires an SMTP or SMS
  // provider configured at the hosting level — until then, staff see new
  // messages the moment they open /admin/contact-messages (marked "new").
  return { success: true };
}

export async function submitInvestorInquiry(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Please enter your name." };

  const { error } = await supabase.from("investor_inquiries").insert({
    name,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    interest_type: (formData.get("interest_type") as string) || null,
    message: (formData.get("message") as string) || null,
  });

  if (error) return { error: "Something went wrong. Please try again or use the details on the Contact page." };
  return { success: true };
}

export async function subscribeNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) return { error: "Please enter a valid email address." };

  const { error } = await supabase.from("newsletter_subscribers").insert({ email });
  if (error) {
    if (error.code === "23505") return { success: true }; // already subscribed — treat as success
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}
