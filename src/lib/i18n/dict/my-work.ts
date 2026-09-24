/**
 * "Mera Kaam" ke alfaz -- staff ka pehla safha.
 *
 * Istilahat glossary.ts se: staff, baqi, shakh.
 *
 * Ye safha sab se zyada dekha jane wala hai (har login par pehla), is
 * liye jumle chhote aur seedhe rakhe gaye hain.
 */
export const myWorkDict = {
  mw_title: { en: "My Work", rm: "Mera Kaam", ur: "میرا کام" },
  mw_subtitle: {
    en: "Only what has been assigned to you",
    rm: "Sirf wohi jo aap ko diya gaya hai",
    ur: "صرف وہی جو آپ کو دیا گیا ہے",
  },
  mw_pending: { en: "pending", rm: "baqi", ur: "باقی" },
  mw_alert: { en: "to check", rm: "dekhein", ur: "دیکھیں" },
  mw_features: { en: "pages", rm: "safhe", ur: "صفحات" },
  mw_nothing_assigned: {
    en: "Nothing has been assigned to you yet",
    rm: "Aap ko abhi tak kuch assign nahi hua",
    ur: "آپ کو ابھی تک کچھ نہیں دیا گیا",
  },
  mw_nothing_assigned_hint: {
    en: "Ask your manager to assign your department. Until then this page stays empty — nothing is broken.",
    rm: "Apne manager se kahein ke wo aap ka department assign karein. Tab tak ye safha khali rehta hai — kuch kharab nahi hua.",
    ur: "اپنے منیجر سے کہیں کہ وہ آپ کا شعبہ دیں۔ تب تک یہ صفحہ خالی رہتا ہے — کچھ خراب نہیں ہوا۔",
  },
} as const;
