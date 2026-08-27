import { createClient } from "@/lib/supabase/server";
import { computeProfileCompletion } from "@/lib/utils/farmer-profile";

export interface VerificationGateResult {
  allowed: boolean;
  reason?: "incomplete_profile" | "pending_review";
}

// Gate for portal features that require a verified farmer (Marketplace,
// Bridge Orders, Sell Produce, Wallet). Dashboard and Profile always
// stay open so a farmer can actually finish their details - blocking
// those too would make it impossible to ever reach "complete".
export async function checkFarmerVerification(farmerId: string): Promise<VerificationGateResult> {
  const supabase = createClient();
  const { data: farmer } = await supabase.from("farmers").select("*").eq("id", farmerId).single();
  if (!farmer) return { allowed: false, reason: "incomplete_profile" };

  const completion = computeProfileCompletion(farmer);
  if (!completion.isComplete) return { allowed: false, reason: "incomplete_profile" };
  if (!farmer.is_verified) return { allowed: false, reason: "pending_review" };

  return { allowed: true };
}

export function verificationGateMessage(reason: "incomplete_profile" | "pending_review") {
  if (reason === "incomplete_profile") {
    return {
      title: "Pehle Apni Profile Mukammal Karein",
      body:
        "Jab tak aap apni Basic Information, Farming Details, aur Documents poori tarah se fill nahi karenge, aap AgriBridge ki suvidhaon (Marketplace, Orders, Sell Produce, Wallet) ka faida nahi utha sakenge. Sahi aur sach\u200ci maloomat den taake hum jaldi verify kar sakein.",
      ctaLabel: "Abhi Profile Complete Karein",
      ctaHref: "/portal/profile",
    };
  }
  return {
    title: "Aapki Profile Review Mein Hai",
    body:
      "Shukriya! Aapne apni profile mukammal kar li hai. Hamari team ise verify kar rahi hai - verification hote hi aap Marketplace, Orders, Sell Produce, aur Wallet use kar sakenge.",
    ctaLabel: "Dashboard Par Wapis Jayein",
    ctaHref: "/portal/dashboard",
  };
}