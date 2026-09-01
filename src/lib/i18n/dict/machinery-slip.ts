/**
 * Machinery ki parchi, booking ka safha, aur chiller.
 *
 * PARCHI PAR HAR KATTI KA APNA KHANA HAI: riayat, advance, kisan ka
 * apna diesel, aur pichla baqi. Ek "kul dena hai" dikhana aasan tha,
 * magar kisan ka pehla sawal yahi hota hai ke KYA KYA kaata gaya -- aur
 * us ka jawab parchi par hona chahiye, munshi ki zabani nahi.
 *
 * "Ye booking ka andaza hai" wala jumla qasdan hai: booking ke waqt
 * jitne acre likhe jate hain wo andaza hote hain. Asal bill kattai ke
 * baad, waqai kaate gaye acre par banta hai. Bina us jumle ke kisan
 * pehli parchi ko hi bill samajh leta hai aur baad mein farq par
 * jhagRa hota hai.
 *
 * BOOKING KE SAFHE PAR ROK KA JUMLA yaad dilata hai ke rok DATABASE
 * mein hai, sirf safhe par nahi. Ye us bande ke liye hai jo samajhta
 * hai ke "browser mein kuch kar ke" nikla ja sakta hai.
 */
export const machinerySlipDict = {
  // ---- Parchi ----
  ms_work: { en: "Work", rm: "Kaam", ur: "کام" },
  ms_bill_after_discount: { en: "Bill after discount", rm: "Riayat ke baad bill", ur: "رعایت کے بعد بل" },
  ms_advance_deducted: { en: "Advance (deducted)", rm: "Advance (kaata gaya)", ur: "ایڈوانس (کاٹا گیا)" },
  ms_your_diesel_deducted: { en: "Your diesel (deducted)", rm: "Aap ka diesel (kaata gaya)", ur: "آپ کا ڈیزل (کاٹا گیا)" },
  ms_paid_earlier: { en: "Paid earlier", rm: "Pehle di hui raqam", ur: "پہلے دی ہوئی رقم" },
  ms_paid_later: { en: "Paid later", rm: "Baad mein mili raqam", ur: "بعد میں ملی رقم" },
  ms_previous_balance: { en: "Previous balance", rm: "Pichla baqi", ur: "پچھلا باقی" },
  ms_previous_total: { en: "Previous total", rm: "Pichla kul", ur: "پچھلا کل" },
  ms_total_due: { en: "Total due", rm: "Kul dena hai", ur: "کل دینا ہے" },
  ms_in_words: { en: "In words:", rm: "Alfaz mein:", ur: "الفاظ میں:" },
  ms_farmer_signature: { en: "Farmer's signature", rm: "Kisan ke dastkhat", ur: "کسان کے دستخط" },
  ms_from_art: { en: "On behalf of Al Rana Traders", rm: "Al Rana Traders ki taraf se", ur: "الرانا ٹریڈرز کی طرف سے" },
  ms_estimate_note: {
    en: "This is the booking estimate. The real bill is made after harvesting, on the acres actually cut.",
    rm: "Ye booking ka andaza hai. Asal bill kattai ke baad, waqai kaate gaye acre par banega.",
    ur: "یہ بکنگ کا اندازہ ہے۔ اصل بل کٹائی کے بعد، واقعی کاٹے گئے ایکڑ پر بنے گا۔",
  },
  ms_pdf_attached: {
    en: "The PDF slip goes straight into the email as an attachment.",
    rm: "PDF parchi seedha email ke saath attachment ban kar chali jayegi.",
    ur: "PDF پرچی سیدھا ای میل کے ساتھ اٹیچمنٹ بن کر چلی جائے گی۔",
  },

  // ---- Booking ka safha ----
  mb_rate_wrong: { en: "Rate written wrong? Fix it", rm: "Rate ghalat likha gaya? Theek karein", ur: "ریٹ غلط لکھا گیا؟ ٹھیک کریں" },
  mb_rate_eg: {
    en: "e.g. the rate should have been Rs 14,000 but Rs 15,000 was entered by mistake",
    rm: "Misal: rate Rs 14,000 hona tha, ghalti se Rs 15,000 likha gaya",
    ur: "مثال: ریٹ 14,000 روپے ہونا تھا، غلطی سے 15,000 روپے لکھا گیا",
  },
  mb_give_discount: { en: "Give the farmer a discount?", rm: "Kisan ko riayat deni hai?", ur: "کسان کو رعایت دینی ہے؟" },
  mb_discount: { en: "Discount", rm: "Riayat", ur: "رعایت" },
  mb_how_much_discount: { en: "How much discount (Rs)", rm: "Kitni riayat (Rs)", ur: "کتنی رعایت (روپے)" },
  mb_discount_eg: {
    en: "e.g. Rs 28,000 was agreed with the farmer",
    rm: "Misal: kisan se Rs 28,000 tay hue the",
    ur: "مثال: کسان سے 28,000 روپے طے ہوئے تھے",
  },
  mb_reason_10: { en: "Reason (at least 10 characters) *", rm: "Wajah (kam az kam 10 harf) *", ur: "وجہ (کم از کم 10 حرف) *" },
  mb_reason_5: {
    en: "Reason (required if there is a discount, at least 5 characters)",
    rm: "Wajah (riayat ho to lazmi, kam az kam 5 harf)",
    ur: "وجہ (رعایت ہو تو لازمی، کم از کم 5 حرف)",
  },
  mb_bill_wrong: { en: "Bill made wrong? Cancel it", rm: "Bill ghalat ban gaya? Mansookh karein", ur: "بل غلط بن گیا؟ منسوخ کریں" },
  mb_cancel_bill: { en: "Cancel the bill", rm: "Bill mansookh karein", ur: "بل منسوخ کریں" },
  mb_ok: { en: "All right", rm: "Theek hai", ur: "ٹھیک ہے" },
  mb_time_backwards: {
    en: "The end time is before or equal to the start. Time moves forward — such an entry cannot be made.",
    rm: "Khatam ka waqt shuru se pehle ya barabar hai. Waqt aage chalta hai -- aisa indraj nahi ho sakta.",
    ur: "ختم کا وقت شروع سے پہلے یا برابر ہے۔ وقت آگے چلتا ہے — ایسا اندراج نہیں ہو سکتا۔",
  },
  mb_machine_unfit: {
    en: "This machine is not fit for work right now (workshop or off). Choose another machine.",
    rm: "Ye machine abhi kaam ke qabil nahi (workshop ya band). Doosri machine chunein.",
    ur: "یہ مشین ابھی کام کے قابل نہیں (ورکشاپ یا بند)۔ دوسری مشین چنیں۔",
  },
  mb_gate_note: {
    en: "This step opens only after the farmer confirms — the lock is in the database, not just on this page.",
    rm: "Ye qadam kisan ki tasdeeq ke baad khulta hai -- rok database mein lagi hui hai, sirf yahan nahi.",
    ur: "یہ قدم کسان کی تصدیق کے بعد کھلتا ہے — روک ڈیٹابیس میں لگی ہوئی ہے، صرف یہاں نہیں۔",
  },
  mb_on_this_machine: { en: "on this machine", rm: "is machine par", ur: "اس مشین پر" },

  // ---- Chiller ----
  ch_only_chiller: { en: "This page is for the chiller and the manager only.", rm: "Ye safha sirf chiller aur manager ke liye hai.", ur: "یہ صفحہ صرف چلر اور منیجر کے لیے ہے۔" },
  ch_show: { en: "Show", rm: "Dikhayein", ur: "دکھائیں" },
  ch_shift: { en: "Shift", rm: "Waqt", ur: "وقت" },
  ch_waiting_fat: { en: "Waiting for FAT", rm: "FAT ka intezar", ur: "FAT کا انتظار" },
  ch_farmer_brought: { en: "Farmer brought it himself", rm: "Kisan khud laya", ur: "کسان خود لایا" },
  ch_mca_milk: { en: "MCA's milk", rm: "MCA ka doodh", ur: "MCA کا دودھ" },
  ch_total_received: { en: "Total received", rm: "Kul mausool", ur: "کل موصول" },
  ch_manager_verify: { en: "Manager Verify", rm: "Manager ki tasdeeq", ur: "منیجر کی تصدیق" },
} as const;
