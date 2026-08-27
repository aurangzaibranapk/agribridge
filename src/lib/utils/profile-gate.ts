import { computeProfileCompletion } from "@/lib/utils/farmer-profile";

// Simple gate for portal pages that just need a farmer's Basic
// Information + Documents complete - no admin approval required, that
// is only needed for the deeper Marketplace/Wallet/Orders gate in
// verification-gate.ts. This one is purely "did you finish the form".
export function checkProfileComplete(farmer: any): boolean {
  const completion = computeProfileCompletion(farmer);
  return completion.isComplete;
}