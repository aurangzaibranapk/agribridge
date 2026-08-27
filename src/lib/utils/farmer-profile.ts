import type { Database } from "@/lib/types/database.types";
type Farmer = Database["public"]["Tables"]["farmers"]["Row"];
export interface ProfileCompletion {
  percent: number;
  isComplete: boolean;
  basicComplete: boolean;
  documentsComplete: boolean;
}
// Two equally-weighted sections, matching the two accordion sections
// still on the Profile page (Farming Overview moved to the My Farms
// page and is no longer required for the profile itself to reach 100%).
export function computeProfileCompletion(farmer: Farmer): ProfileCompletion {
  const basicComplete = Boolean(farmer.full_name && farmer.cnic && farmer.village && farmer.district);
  const documentsComplete = Boolean((farmer as any).cnic_image_url && (farmer as any).cnic_back_image_url);
  const sectionsComplete = [basicComplete, documentsComplete].filter(Boolean).length;
  const percent = sectionsComplete === 2 ? 100 : Math.round((sectionsComplete / 2) * 100);
  return {
    percent,
    isComplete: sectionsComplete === 2,
    basicComplete,
    documentsComplete,
  };
}