export type MotivationLanguage = "rm" | "ur" | "en";

export interface StaffMotivationInput {
  name?: string | null;
  score?: number | null;
  role?: string | null;
  language?: MotivationLanguage | string | null;
  salesAmount?: number | null;
  targetAmount?: number | null;
}

export interface StaffMotivation {
  title: string;
  message: string;
  action: string;
  tone: "focus" | "improving" | "good" | "excellent";
  source: "performance-rule";
}

/**
 * Daily Staff Motivation AI rules.
 *
 * Deterministic and safe first rollout: it never invents sales, bonuses,
 * or achievements. Gemini can later use this contract as its fallback.
 */
export function buildStaffMotivation(input: StaffMotivationInput): StaffMotivation {
  const language = input.language ?? "rm";
  const score = input.score == null ? null : Math.max(0, Math.min(100, input.score));
  const target = input.targetAmount ?? null;
  const sales = input.salesAmount ?? null;
  const progress = target && target > 0 && sales != null ? Math.round((sales / target) * 100) : null;

  if (language === "ur") {
    if (score != null && score >= 85) return { title: "آج کی شاباش", message: "آپ کی مسلسل محنت ٹیم کے لیے مثال ہے۔ اسی جذبے کے ساتھ آج بھی بہترین کام جاری رکھیں۔", action: "اپنی رفتار برقرار رکھیں۔", tone: "excellent", source: "performance-rule" };
    if (score != null && score >= 65) return { title: "بہت خوب، آگے بڑھیں", message: "آپ کی کارکردگی اچھی سمت میں جا رہی ہے۔ روزانہ کی چھوٹی کوششیں بڑی کامیابی بناتی ہیں۔", action: "آج ایک قدم مزید آگے بڑھائیں۔", tone: "good", source: "performance-rule" };
    if (score != null && score >= 40) return { title: "آج کا حوصلہ", message: "بہتری کا سفر جاری ہے۔ اپنی توجہ، رفتار اور گاہک کی خدمت پر اعتماد رکھیں۔", action: "آج کا کام کل سے بہتر کریں۔", tone: "improving", source: "performance-rule" };
    return { title: "کوشش جاری رکھیں", message: "کامیابی قسمت نہیں، روزانہ کی محنت اور مستقل مزاجی سے بنتی ہے۔ ہر دن نئی شروعات ہے۔", action: "ایک کام مکمل کریں اور اگلا قدم اٹھائیں۔", tone: "focus", source: "performance-rule" };
  }

  if (language === "en") {
    if (score != null && score >= 85) return { title: "Today’s Recognition", message: "Your consistency is setting a strong example for the team. Keep the same energy today.", action: "Maintain your momentum.", tone: "excellent", source: "performance-rule" };
    if (score != null && score >= 65) return { title: "Good Progress", message: "Your performance is moving in the right direction. Small daily efforts create lasting success.", action: "Take one more step forward today.", tone: "good", source: "performance-rule" };
    if (score != null && score >= 40) return { title: "Today’s Encouragement", message: "Improvement is a journey. Stay focused on service, accuracy, and steady progress.", action: "Make today better than yesterday.", tone: "improving", source: "performance-rule" };
    return { title: "Keep Going", message: "Success is not luck; it is built through daily effort and consistency. Every day is a fresh start.", action: "Complete one task, then take the next step.", tone: "focus", source: "performance-rule" };
  }

  const scoreText = score == null ? "" : ` Aap ka performance score ${Math.round(score)}/100 hai.`;
  const progressText = progress != null ? ` Aaj target ka ${progress}% complete hua hai.` : "";
  if (score != null && score >= 85) return { title: "Aaj ki Shabash", message: `Aap ki lagataar mehnat team ke liye misaal hai.${scoreText}${progressText} Isi jazbay ke sath aaj bhi behtareen kaam jari rakhein.`, action: "Apni raftaar barqarar rakhein.", tone: "excellent", source: "performance-rule" };
  if (score != null && score >= 65) return { title: "Bohat Khoob, Aagay Barhein", message: `Aap ki performance achi simt mein ja rahi hai.${scoreText}${progressText} Rozana ki chhoti koshishen bari kamyabi banati hain.`, action: "Aaj aik qadam mazeed aagay barhain.", tone: "good", source: "performance-rule" };
  if (score != null && score >= 40) return { title: "Aaj Ka Hausla", message: `Behtari ka safar jari hai.${scoreText}${progressText} Apni tawajjo, raftaar aur customer service par bharosa rakhein.`, action: "Aaj ka kaam kal se behtar karein.", tone: "improving", source: "performance-rule" };
  return { title: "Koshish Jari Rakhein", message: `Kamyabi qismat nahi, rozana ki mehnat aur mustaqil mizaji se banti hai.${scoreText}${progressText} Har din nayi shuruaat hai.`, action: "Aik kaam mukammal karein aur agla qadam uthayen.", tone: "focus", source: "performance-rule" };
}
