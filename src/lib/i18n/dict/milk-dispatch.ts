/**
 * Doodh ki rawangi ke alfaz.
 *
 * Istilahat glossary.ts se: doodh, shakh, tareekh, kami, gaari.
 *
 * "Kami" ka lafz jaan boojh kar wahi hai jo Route & Shortage wale safhe
 * par chalta hai -- ek hi karobar mein doodh ki kami ke do naam nahi
 * hone chahiyen.
 */
export const milkDispatchDict = {
  mdp_title: { en: "Milk Dispatch", rm: "Doodh ki Rawangi", ur: "دودھ کی روانگی" },
  md_subtitle: {
    en: "From the chiller to the company — how much went, and how much they acknowledged",
    rm: "Chiller se company tak — kitna gaya, aur company ne kitna mana",
    ur: "چلر سے کمپنی تک — کتنا گیا، اور کمپنی نے کتنا مانا",
  },
  md_new: { en: "New dispatch", rm: "Nayi rawangi", ur: "نئی روانگی" },
  md_record: { en: "Record", rm: "Darj karein", ur: "درج کریں" },
  md_chiller: { en: "Chiller", rm: "Chiller", ur: "چلر" },
  md_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  md_shift: { en: "Shift", rm: "Waqt", ur: "وقت" },
  md_morning: { en: "Morning", rm: "Subah", ur: "صبح" },
  md_evening: { en: "Evening", rm: "Shaam", ur: "شام" },
  md_sent: { en: "Sent", rm: "Gaya", ur: "گیا" },
  md_received: { en: "Company acknowledged", rm: "Company ne mana", ur: "کمپنی نے مانا" },
  md_vehicle: { en: "Vehicle", rm: "Gaari", ur: "گاڑی" },
  md_driver: { en: "Driver", rm: "Driver", ur: "ڈرائیور" },
  md_notes: { en: "Notes", rm: "Notes", ur: "نوٹس" },
  md_save: { en: "Save", rm: "Mehfooz karein", ur: "محفوظ کریں" },
  md_saving: { en: "Saving...", rm: "Mehfooz ho raha hai...", ur: "محفوظ ہو رہا ہے..." },
  md_awaiting: { en: "Awaiting the company's receipt", rm: "Company ki raseed ka intezar", ur: "کمپنی کی رسید کا انتظار" },
  md_save_receipt: { en: "Save receipt", rm: "Raseed darj karein", ur: "رسید درج کریں" },
  md_waiting: { en: "waiting", rm: "intezar", ur: "انتظار" },
  md_history: { en: "Past dispatches", rm: "Pichli rawangiyan", ur: "پچھلی روانگیاں" },
  md_none: { en: "No dispatch recorded yet.", rm: "Abhi koi rawangi darj nahi.", ur: "ابھی کوئی روانگی درج نہیں۔" },
  md_shortage: { en: "Shortage", rm: "Kami", ur: "کمی" },
} as const;
