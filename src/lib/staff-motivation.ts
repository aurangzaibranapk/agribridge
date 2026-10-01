export type MotivationLanguage = "rm" | "ur" | "en";

export interface StaffMotivationInput {
  name?: string | null;
  score?: number | null;
  role?: string | null;
  language?: MotivationLanguage | string | null;
  salesAmount?: number | null;
  targetAmount?: number | null;
  /** Absolute day count (Math.floor(Date.now()/86400000)) for daily rotation. */
  dayIndex?: number | null;
}

export interface StaffMotivation {
  title: string;
  message: string;
  action: string;
  tone: "focus" | "improving" | "good" | "excellent";
  source: "performance-rule";
}

type UrMsg = { title: string; message: string; action: string };

const UR_FOCUS: UrMsg[] = [
  { title: "کوشش جاری رکھیں", message: "کامیابی قسمت نہیں، روزانہ کی محنت اور مستقل مزاجی سے بنتی ہے۔ ہر دن نئی شروعات ہے۔", action: "ایک کام مکمل کریں اور اگلا قدم اٹھائیں۔" },
  { title: "آگے بڑھتے رہیں", message: "چھوٹی چھوٹی کوششیں مل کر بڑی منزلیں بناتی ہیں۔ آج کا ایک قدم کل کی کامیابی کی بنیاد ہے۔", action: "آج کا ایک کام پوری توجہ سے کریں۔" },
  { title: "ہمت نہ ہاریں", message: "راہ مشکل ہو تو رفتار کم کریں مگر چلتے رہیں — رکنا ہی واحد ناکامی ہے۔", action: "ایک چھوٹی چیز بہتر کریں، باقی خود بدلے گا۔" },
  { title: "اپنا بہترین دیں", message: "جو لوگ ہمت نہیں ہارتے، وہی آگے جاتے ہیں۔ آج اپنا بہترین دیں، نتیجہ ضرور آئے گا۔", action: "ابھی ایک کام شروع کریں اور اسے مکمل کریں۔" },
  { title: "خود سے مقابلہ", message: "خود کو کل سے بہتر بنانا ہی اصل ترقی ہے — دوسروں سے نہیں، اپنے آپ سے مقابلہ کریں۔", action: "آج کے کاموں کی فہرست بنائیں اور ایک ایک کریں۔" },
];

const UR_IMPROVING: UrMsg[] = [
  { title: "آج کا حوصلہ", message: "بہتری کا سفر جاری ہے۔ اپنی توجہ، رفتار اور گاہک کی خدمت پر بھروسہ رکھیں۔", action: "آج کا کام کل سے بہتر کریں۔" },
  { title: "صحیح راستے پر ہیں", message: "آپ صحیح راستے پر ہیں — قدم جمائے رکھیں، منزل قریب آ رہی ہے۔", action: "کسی ایک کمزور پہلو کو آج بہتر کریں۔" },
  { title: "مستقل رہیں", message: "مستقل مزاجی کامیابی کی کنجی ہے۔ ہر دن کی محنت آپ کو منزل کے قریب لاتی ہے۔", action: "آج گاہکوں کو بہترین خدمت دیں۔" },
  { title: "کوشش نظر آ رہی ہے", message: "آپ کی کوشش نظر آ رہی ہے — اسی جذبے کے ساتھ آگے بڑھتے رہیں۔", action: "ایک نئی عادت بنائیں اور اسے ہر روز دہرائیں۔" },
  { title: "چھوٹے قدم، بڑی منزل", message: "ترقی یکدم نہیں آتی — چھوٹے قدم ہی بڑی کامیابی بناتے ہیں، صبر رکھیں۔", action: "آج کا کام صحیح طریقے سے کریں، جلدی نہ کریں۔" },
];

const UR_GOOD: UrMsg[] = [
  { title: "بہت خوب، آگے بڑھیں", message: "آپ کی کارکردگی اچھی سمت میں جا رہی ہے۔ روزانہ کی چھوٹی کوششیں بڑی کامیابی بناتی ہیں۔", action: "آج ایک قدم مزید آگے بڑھائیں۔" },
  { title: "محنت رنگ لا رہی ہے", message: "محنت رنگ لا رہی ہے — ابھی رکنا نہیں، آگے ابھی اور مواقع ہیں۔", action: "ٹیم کے ساتھ مل کر آج کچھ نیا کریں۔" },
  { title: "آپ مثال بن رہے ہیں", message: "آپ کی اچھی کارکردگی ٹیم کو حوصلہ دیتی ہے — آپ مثال بن رہے ہیں۔", action: "آج اپنے کسی ساتھی کی مدد کریں۔" },
  { title: "صلاحیت ثابت ہو رہی ہے", message: "آپ کی صلاحیت ثابت ہو رہی ہے — بس یہی لگن اور توجہ جاری رکھیں۔", action: "آج اپنے سب سے اہم کام پر پوری توجہ دیں۔" },
  { title: "اگلا مرحلہ اور بہتر", message: "آپ درست سمت میں ہیں — اگلا مرحلہ اور بھی بہتر ہو سکتا ہے۔", action: "گاہکوں سے رائے لیں اور اپنی خدمت بہتر کریں۔" },
];

const UR_EXCELLENT: UrMsg[] = [
  { title: "آج کی شاباش", message: "آپ کی مسلسل محنت ٹیم کے لیے مثال ہے۔ اسی جذبے کے ساتھ آج بھی بہترین کام جاری رکھیں۔", action: "اپنی رفتار برقرار رکھیں۔" },
  { title: "کامیابی کا راز", message: "آپ کی کامیابی آپ کی روزانہ کی محنت کا نتیجہ ہے — اسی عادت کو برقرار رکھیں۔", action: "آج اپنی کسی پرانی غلطی سے کچھ نیا سیکھیں۔" },
  { title: "اعلیٰ معیار", message: "آپ اعلیٰ سطح پر کام کر رہے ہیں — یہی معیار ٹیم کو اوپر اٹھاتا ہے۔", action: "آج کسی نئے ساتھی کو کچھ سکھائیں۔" },
  { title: "شاندار کارکردگی", message: "شاندار کارکردگی کا راز مستقل مزاجی ہے — آپ نے ثابت کیا ہے۔", action: "ایک نیا ہدف طے کریں اور اس کی طرف بڑھنا شروع کریں۔" },
  { title: "قابلِ تعریف لگن", message: "آپ کی لگن اور محنت قابلِ تعریف ہے — ایسے ہی جاری رہیں۔", action: "اپنی کامیابی کا راز ٹیم کے ساتھ بانٹیں۔" },
];

function pick<T>(arr: T[], dayIndex: number): T {
  return arr[Math.abs(dayIndex) % arr.length];
}

/**
 * Daily Staff Motivation — deterministic rotation by dayIndex (absolute day count).
 * Urdu messages rotate through 5 per score band so staff sees a fresh message each day.
 */
export function buildStaffMotivation(input: StaffMotivationInput): StaffMotivation {
  const language = input.language ?? "rm";
  const score = input.score == null ? null : Math.max(0, Math.min(100, input.score));
  const target = input.targetAmount ?? null;
  const sales = input.salesAmount ?? null;
  const progress = target && target > 0 && sales != null ? Math.round((sales / target) * 100) : null;
  const day = input.dayIndex ?? 0;

  if (language === "ur") {
    if (score != null && score >= 85) { const m = pick(UR_EXCELLENT, day); return { ...m, tone: "excellent", source: "performance-rule" }; }
    if (score != null && score >= 65) { const m = pick(UR_GOOD, day); return { ...m, tone: "good", source: "performance-rule" }; }
    if (score != null && score >= 40) { const m = pick(UR_IMPROVING, day); return { ...m, tone: "improving", source: "performance-rule" }; }
    const m = pick(UR_FOCUS, day); return { ...m, tone: "focus", source: "performance-rule" };
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
