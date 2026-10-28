/**
 * Public dairy offer (website /dairy aur /bulk-order).
 *
 * Saari qeematein aur shartein owner ki batayi hui hain (19 Oct 2026).
 * Ye sirf dikhane ka data hai: koi DB read/write nahi, koi message
 * khud nahi jata. WhatsApp link sirf app kholta hai; bhejna customer
 * khud dabata hai, aur staff confirm karta hai.
 */

export const SITE_URL = "https://alranatraders.pk";
export const WHATSAPP_DISPLAY = "0322 6275476";
export const WHATSAPP_E164 = "923226275476";

export type DairyOffer = {
  city: string;
  price: number;
  unitCode: "LTR" | "KGM" | null;
  unitText: string;
};

export type DairyProduct = {
  id: "doodh-13-ts" | "desi-ghee" | "desi-anday";
  nameEn: string;
  nameRoman: string;
  nameUrdu: string;
  descRoman: string;
  descUrdu: string;
  offers: DairyOffer[];
  photoAltUrdu: string;
};

export const DAIRY_PRODUCTS: DairyProduct[] = [
  {
    id: "doodh-13-ts",
    nameEn: "Pure Milk 13 TS",
    nameRoman: "Khalis Doodh 13 TS",
    nameUrdu: "خالص دودھ 13 TS",
    descRoman:
      "13 TS ka matlab doodh mein 13% total solids (fat + SNF). Kisanon se seedhi collection, darmiyan mein koi dodhi nahi. Thandi gaari mein chill kar ke bheja jata hai.",
    descUrdu:
      "13 TS کا مطلب ہے دودھ میں 13 فیصد ٹھوس اجزا (چکنائی اور SNF)۔ کسانوں سے براہِ راست جمع کیا گیا، درمیان میں کوئی دودھی نہیں۔ ٹھنڈی گاڑی میں چِل کر کے بھیجا جاتا ہے۔",
    offers: [
      { city: "Lahore", price: 200, unitCode: "LTR", unitText: "per litre" },
      { city: "Islamabad", price: 230, unitCode: "LTR", unitText: "per litre" },
    ],
    photoAltUrdu: "خالص دودھ کی تصویر جلد آ رہی ہے",
  },
  {
    id: "desi-ghee",
    nameEn: "Desi Ghee",
    nameRoman: "Desi Ghee",
    nameUrdu: "دیسی گھی",
    descRoman: "Khalis desi ghee, hamare apne doodh se. Rozana 100 kg tak dastiyab.",
    descUrdu: "خالص دیسی گھی، ہمارے اپنے دودھ سے۔ روزانہ 100 کلو تک دستیاب۔",
    offers: [{ city: "Pakistan", price: 4000, unitCode: "KGM", unitText: "per kg" }],
    photoAltUrdu: "دیسی گھی کی تصویر جلد آ رہی ہے",
  },
  {
    id: "desi-anday",
    nameEn: "Desi Eggs",
    nameRoman: "Desi Anday",
    nameUrdu: "دیسی انڈے",
    descRoman: "Khalis desi anday. Rozana 100 se 200 anday dastiyab (abhi shuru kiya hai).",
    descUrdu: "خالص دیسی انڈے۔ روزانہ 100 سے 200 انڈے دستیاب (ابھی شروع کیا ہے)۔",
    offers: [{ city: "Pakistan", price: 30, unitCode: null, unitText: "per egg" }],
    photoAltUrdu: "دیسی انڈوں کی تصویر جلد آ رہی ہے",
  },
];

export const SUPPLY = {
  dailyLitresNow: "5,000–6,000",
  dailyLitresTarget: "10,000",
  lahoreMinimumLitres: 200,
  gheeKgPerDay: "100",
  eggsPerDay: "100–200",
  payment: ["Cash on delivery", "Advance"],
};

export const DAIRY_FAQ: { qRoman: string; aRoman: string; qUrdu: string; aUrdu: string }[] = [
  {
    qRoman: "13 TS kya hai?",
    aRoman: "Doodh ke kul thos ajza (fat + SNF) 13% hain. Jitna zyada TS, utna gaarha doodh.",
    qUrdu: "13 TS کیا ہے؟",
    aUrdu: "دودھ کے کل ٹھوس اجزا (چکنائی اور SNF) 13 فیصد ہیں۔ جتنا زیادہ TS، اتنا گاڑھا دودھ۔",
  },
  {
    qRoman: "Rozana kitna doodh mil sakta hai?",
    aRoman: "Abhi rozana 5,000 se 6,000 litre dastiyab hai, aur zaroorat par 10,000 litre tak barha sakte hain.",
    qUrdu: "روزانہ کتنا دودھ مل سکتا ہے؟",
    aUrdu: "ابھی روزانہ 5,000 سے 6,000 لیٹر دستیاب ہے، اور ضرورت پر 10,000 لیٹر تک بڑھا سکتے ہیں۔",
  },
  {
    qRoman: "Desi ghee aur desi anday kitne milte hain?",
    aRoman: "Desi ghee rozana 100 kg tak, aur desi anday rozana 100 se 200 (abhi shuru kiya hai).",
    qUrdu: "دیسی گھی اور دیسی انڈے کتنے ملتے ہیں؟",
    aUrdu: "دیسی گھی روزانہ 100 کلو تک، اور دیسی انڈے روزانہ 100 سے 200 (ابھی شروع کیا ہے)۔",
  },
  {
    qRoman: "Lahore mein kam se kam order kitna hai?",
    aRoman: "Lahore mein kam se kam 200 litre. Doosre shehron ke liye WhatsApp par poochein.",
    qUrdu: "لاہور میں کم از کم آرڈر کتنا ہے؟",
    aUrdu: "لاہور میں کم از کم 200 لیٹر۔ دوسرے شہروں کے لیے واٹس ایپ پر پوچھیں۔",
  },
  {
    qRoman: "Doodh thanda kaise pohnchta hai?",
    aRoman: "Doodh chill kar ke thandi gaari mein bheja jata hai.",
    qUrdu: "دودھ ٹھنڈا کیسے پہنچتا ہے؟",
    aUrdu: "دودھ چِل کر کے ٹھنڈی گاڑی میں بھیجا جاتا ہے۔",
  },
  {
    qRoman: "Adaigi kaise hogi?",
    aRoman: "Cash on delivery ya advance, jaise aap ko aasaan ho.",
    qUrdu: "ادائیگی کیسے ہوگی؟",
    aUrdu: "کیش آن ڈیلیوری یا ایڈوانس، جیسے آپ کو آسان ہو۔",
  },
  {
    qRoman: "Kya aap ka karobar registered hai?",
    aRoman: "Ji haan, hamara khane ka karobar registered hai.",
    qUrdu: "کیا آپ کا کاروبار رجسٹرڈ ہے؟",
    aUrdu: "جی ہاں، ہمارا کھانے کا کاروبار رجسٹرڈ ہے۔",
  },
];

export type BulkOrderInput = {
  name: string;
  business?: string;
  city: string;
  area?: string;
  milkLitresPerDay?: string;
  gheeKg?: string;
  eggs?: string;
  note?: string;
};

const clean = (v: string | undefined, max = 120) =>
  (v ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

/** Prefilled WhatsApp text. Kuch bhejta nahi, sirf text banata hai. */
export function buildBulkOrderText(input: BulkOrderInput): string {
  const lines = ["Assalam o Alaikum, Al Rana Traders. Bulk order ki maloomat chahiye:"];
  const add = (label: string, v?: string) => {
    const c = clean(v);
    if (c) lines.push(`${label}: ${c}`);
  };
  add("Naam", input.name);
  add("Karobar", input.business);
  add("Shehar", input.city);
  add("Area", input.area);
  add("Doodh (litre rozana)", input.milkLitresPerDay);
  add("Desi ghee (kg)", input.gheeKg);
  add("Desi anday (tadaad)", input.eggs);
  add("Note", clean(input.note, 300));
  return lines.join("\n");
}

export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_E164}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function productJsonLd(pageUrl: string) {
  return DAIRY_PRODUCTS.map((p) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${pageUrl}#${p.id}`,
    name: p.nameEn,
    alternateName: [p.nameRoman, p.nameUrdu],
    description: p.descRoman,
    brand: { "@type": "Brand", name: "Al Rana Traders" },
    offers: p.offers.map((o) => ({
      "@type": "Offer",
      price: String(o.price),
      priceCurrency: "PKR",
      availability: "https://schema.org/InStock",
      url: `${pageUrl}#${p.id}`,
      areaServed: o.city === "Pakistan" ? { "@type": "Country", name: "Pakistan" } : { "@type": "City", name: o.city },
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(o.price),
        priceCurrency: "PKR",
        ...(o.unitCode ? { unitCode: o.unitCode } : {}),
        unitText: o.unitText,
      },
    })),
  }));
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: DAIRY_FAQ.map((f) => ({
      "@type": "Question",
      name: f.qRoman,
      acceptedAnswer: { "@type": "Answer", text: f.aRoman },
    })),
  };
}

/** Words that must never appear on these pages (local names, health claims). */
export const BANNED_PUBLIC_WORDS = [
  "mahabali", "bhowana", "chiniot",
  "cure", "ilaaj", "immunity", "qowat-e-mudafiat", "sehat ke liye", "shifa", "cholesterol", "weight loss", "organic",
];
