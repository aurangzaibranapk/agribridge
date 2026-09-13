/**
 * Kisan ka udhaar -- dena, wapas lena, hadd baandhna.
 *
 * Sanjhe alfaz (Farmer, Date, Amount, Notes, Type, Credit Limit,
 * Seed/Fertilizer/Pesticide/Machinery) yahan dobara nahi likhe -- wo
 * common.ts mein hain.
 *
 * EK BAAT JO IS SAFHE PAR KHAAS HAI. "Koi outstanding credit nahi hai"
 * ka matlab hai ke DEKH liya aur kisi par kuch baqi nahi. Ye us se alag
 * hai jab kisi ko dekhne ka haq hi na ho. Us liye alag jumla hai
 * (c_only_finance_admin) -- kyunke "kuch nahi mila" ko "sifar hai"
 * samajh lena is nizam mein pehle bhi ghalat adad de chuka hai.
 */
export const farmerCreditDict = {
  fc_farmer_balances: { en: "Farmer-wise Balances", rm: "Kis kisan ka kitna khata", ur: "کس کسان کا کتنا کھاتہ" },
  fc_no_outstanding: { en: "No outstanding credit.", rm: "Kisi kisan par udhaar baqi nahi.", ur: "کسی کسان پر ادھار باقی نہیں۔" },
  fc_full_history: { en: "Full Recent History", rm: "Poori aakhri tafseel", ur: "پوری آخری تفصیل" },
  fc_taken_by: { en: "Taken By", rm: "Le kar jane wala", ur: "لے کر جانے والا" },

  fc_issue_credit: { en: "Issue Credit", rm: "Udhaar dein", ur: "ادھار دیں" },
  fc_credit_issued: { en: "Credit issued.", rm: "Udhaar darj ho gaya.", ur: "ادھار درج ہو گیا۔" },
  fc_wanda: { en: "Wanda (feed)", rm: "Wanda", ur: "ونڈا" },
  fc_milk_auto: { en: "Milk (weekly auto-deduct)", rm: "Doodh (har hafte khud katta hai)", ur: "دودھ (ہر ہفتے خود کٹتا ہے)" },
  fc_who_took: {
    en: "Who took it? (if not the farmer himself)",
    rm: "Le kar kaun gaya? (agar kisan khud nahi)",
    ur: "لے کر کون گیا؟ (اگر کسان خود نہیں)",
  },
  fc_notes_example: { en: "e.g. DAP 2 bags, 5 acres", rm: "misal: DAP 2 boray, 5 acre", ur: "مثال: DAP 2 بورے، 5 ایکڑ" },

  fc_record_repayment: { en: "Record Repayment", rm: "Wapsi darj karein", ur: "واپسی درج کریں" },
  fc_repayment_done: { en: "Repayment recorded.", rm: "Wapsi darj ho gayi.", ur: "واپسی درج ہو گئی۔" },

  fc_migrate: { en: "Migrate from DigiKhata", rm: "DigiKhata se laayein", ur: "ڈیجی کھاتہ سے لائیں" },
  fc_migrated: { en: "Migrated.", rm: "Aa gaya.", ur: "آ گیا۔" },
  fc_migrate_note: {
    en: 'Enter the old DigiKhata total balance here once — it is saved with the note "migrated from DigiKhata". This can be done only once per farmer.',
    rm: 'Purane DigiKhata ka kul baqi ek dafa yahan likhein -- "DigiKhata se aaya" ke note ke sath mehfooz hoga. Har kisan ke liye sirf ek dafa ho sakta hai.',
    ur: 'پرانے ڈیجی کھاتہ کا کل باقی ایک دفعہ یہاں لکھیں — "ڈیجی کھاتہ سے آیا" کے نوٹ کے ساتھ محفوظ ہوگا۔ ہر کسان کے لیے صرف ایک دفعہ ہو سکتا ہے۔',
  },
  fc_migrate_amount_eg: { en: "e.g. 50000 or -20000", rm: "misal: 50000 ya -20000", ur: "مثال: 50000 یا -20000" },
  fc_optional_detail: { en: "Optional extra detail", rm: "Mazeed tafseel (marzi se)", ur: "مزید تفصیل (مرضی سے)" },

  fc_set_limit: { en: "Set Credit Limit", rm: "Udhaar ki hadd baandhein", ur: "ادھار کی حد باندھیں" },
  fc_limit_set: { en: "Limit set.", rm: "Hadd lag gayi.", ur: "حد لگ گئی۔" },
  fc_limit_field: {
    en: "Credit Limit (Rs.) — leave blank to remove the limit",
    rm: "Udhaar ki hadd (Rs.) -- khali chhoRein to hadd hat jayegi",
    ur: "ادھار کی حد (روپے) — خالی چھوڑیں تو حد ہٹ جائے گی",
  },
  fc_limit_amount_eg: { en: "e.g. 100000", rm: "misal: 100000", ur: "مثال: 100000" },
} as const;
