"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function updateSubscriptionSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (!["super_admin", "admin", "owner"].includes(profile?.role ?? "")) return { error: "Sirf Admin ye setting badal sakta hai." };

  const isEnforced = formData.get("is_enforced") === "on";
  const minimumAmount = Number(formData.get("minimum_amount") ?? 0);
  if (minimumAmount < 0) return { error: "Amount sahi likhein." };

  const { error } = await supabase
    .from("subscription_settings")
    .update({ is_enforced: isEnforced, minimum_amount: minimumAmount })
    .eq("id", true);
  if (error) return { error: error.message };

  revalidatePath("/admin/subscriptions");
  return { success: true };
}

const PLAN_DAYS: Record<string, number> = {
  "1_month": 30,
  "3_month": 90,
  "1_year": 365,
  "3_year": 1095,
  lifetime: 36500,
};

export async function activateFarmerSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const amountPaid = Number(formData.get("amount_paid") ?? 0);
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const planDuration = String(formData.get("plan_duration") ?? "1_year");

  if (!farmerId) return { error: "Farmer select karein." };
  if (!amountPaid || amountPaid <= 0) return { error: "Amount sahi likhein." };
  if (!PLAN_DAYS[planDuration]) return { error: "Plan Duration sahi select karein." };

  let receiptPhotoUrl: string | null = null;
  const receiptPhoto = formData.get("receipt_photo");
  if (receiptPhoto instanceof File && receiptPhoto.size > 0) {
    const path = `${Date.now()}-${receiptPhoto.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("subscription-receipts").upload(path, receiptPhoto);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("subscription-receipts").getPublicUrl(path);
      receiptPhotoUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + PLAN_DAYS[planDuration]);

  const { error } = await supabase.from("farmer_subscriptions").insert({
    farmer_id: farmerId,
    amount_paid: amountPaid,
    payment_method: paymentMethod,
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
    status: "active",
    receipt_photo_url: receiptPhotoUrl,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/subscriptions");
  return { success: true };
}

export async function checkFarmerSubscriptionAccess(farmerId: string): Promise<{ hasAccess: boolean; minimumAmount: number }> {
  const supabase = createClient();
  const { data: settings } = await supabase.from("subscription_settings").select("is_enforced, minimum_amount").eq("id", true).single();

  if (!settings?.is_enforced) return { hasAccess: true, minimumAmount: settings?.minimum_amount ?? 0 };

  const today = new Date().toISOString().slice(0, 10);
  const { data: activeSub } = await supabase
    .from("farmer_subscriptions")
    .select("id")
    .eq("farmer_id", farmerId)
    .eq("status", "active")
    .gte("end_date", today)
    .limit(1)
    .maybeSingle();

  return { hasAccess: !!activeSub, minimumAmount: settings.minimum_amount };
}