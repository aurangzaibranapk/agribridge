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
  // Staff Command Center (277) -- malik ka naya naqsha
  mw_hello_morning: { en: "Good morning", rm: "Subah bakhair", ur: "صبح بخیر" },
  mw_hello_afternoon: { en: "Good afternoon", rm: "Assalam-o-Alaikum", ur: "السلام علیکم" },
  mw_hello_evening: { en: "Good evening", rm: "Shaam bakhair", ur: "شام بخیر" },
  mw_need_you: { en: "{n} things need your attention today.", rm: "Aaj {n} cheezein aap ki tawajjo maang rahi hain.", ur: "آج {n} چیزیں آپ کی توجہ مانگ رہی ہیں۔" },
  mw_need_none: { en: "Nothing is pending on your pages right now.", rm: "Abhi aap ke safhon par kuch baqi nahi.", ur: "ابھی آپ کے صفحوں پر کچھ باقی نہیں۔" },
  mw_need_unknown: { en: "Some counts could not be read — open the pages to check.", rm: "Kuch ginti nahi mil saki -- safhe khol kar dekh lein.", ur: "کچھ گنتی نہیں مل سکی" },
  mw_quick_clear: { en: "Nothing is pending on your pages right now.", rm: "Abhi aap ke zimme kuch baqi nahi.", ur: "ابھی آپ کے ذمے کچھ باقی نہیں۔" },
  mw_quick: { en: "Today's work", rm: "Aaj ka kaam", ur: "آج کا کام" },
  mw_depts: { en: "Your departments", rm: "Aap ke department", ur: "آپ کے شعبے" },
  mw_tools_n: { en: "{n} tools", rm: "{n} auzaar", ur: "{n} اوزار" },
  mw_need_n: { en: "{n} need attention", rm: "{n} par kaam baqi", ur: "{n} پر کام باقی" },
  mw_all_clear: { en: "All clear", rm: "Sab theek", ur: "سب ٹھیک" },
  mw_count_unknown: { en: "Count not available", rm: "Ginti nahi mili", ur: "گنتی نہیں ملی" },
  mw_open: { en: "Open", rm: "Kholein", ur: "کھولیں" },
  mw_recent: { en: "Recently used", rm: "Haal hi mein istemal", ur: "حال ہی میں استعمال" },
  mw_show_tools: { en: "Show tools", rm: "Auzaar dikhayein", ur: "اوزار دکھائیں" },
  mw_hide_tools: { en: "Hide", rm: "Chhupayein", ur: "چھپائیں" },
  mw_b_sales_today: { en: "sales today", rm: "aaj ki bikri", ur: "آج کی بکری" },
  mw_b_products: { en: "products", rm: "cheezein", ur: "چیزیں" },
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

  // ---- Sidebar ke baghair dashboards (250) ----
  mw_my_score: { en: "My score", rm: "Mera score", ur: "میرا اسکور" },
  mw_score_building: {
    en: "Being worked out",
    rm: "Hisaab ban raha hai",
    ur: "حساب بن رہا ہے",
  },
} as const;
