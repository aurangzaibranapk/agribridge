/**
 * Machinery ki kaam-qataron ke alfaz.
 *
 * Istilahat glossary.ts se: booking, rate, machine, kaam, bill, kisan,
 * tareekh, acre.
 *
 * Har qatar ke sath ek chhota jumla hai jo batata hai ke YE QATAR KYUN
 * BANI. Sirf naam kaafi nahi hota: "Machine bhejna" padh kar banda ye
 * nahi jaanta ke is mein wo bookings hain jin par kisan raazi ho chuka
 * hai -- aur yehi wo baat hai jo usay agla qadam uthane deti hai.
 */
export const machineryQueueDict = {
  mq_subtitle: {
    en: "What is waiting for you — the list builds itself",
    rm: "Aap ke intezar mein kya hai — fehrist khud banti hai",
    ur: "آپ کے انتظار میں کیا ہے — فہرست خود بنتی ہے",
  },
  mq_empty: { en: "Nothing waiting.", rm: "Kuch intezar mein nahi.", ur: "کچھ انتظار میں نہیں۔" },
  mq_days_old: { en: "days old", rm: "din purani", ur: "دن پرانی" },
  mq_date_passed: { en: "date passed", rm: "tareekh guzar gayi", ur: "تاریخ گزر گئی" },
  mq_field_not_ready: { en: "field not ready", rm: "khet tayyar nahi", ur: "کھیت تیار نہیں" },

  // --- Safhon ke unwan ---
  mq_title_assign: { en: "Machine Assignment", rm: "Machine Bhejna", ur: "مشین بھیجنا" },
  mq_title_schedule: { en: "Harvest Schedule", rm: "Kattai ka Schedule", ur: "کٹائی کا شیڈول" },
  mq_title_work: { en: "Work Completion", rm: "Kaam Darj Karna", ur: "کام درج کرنا" },
  mq_title_billing: { en: "Final Bill / Payment", rm: "Bill aur Adaigi", ur: "بل اور ادائیگی" },

  // --- Qataron ke naam aur wajah ---
  mq_rate_send: { en: "Rate to be sent", rm: "Rate bhejna hai", ur: "ریٹ بھیجنا ہے" },
  mq_rate_send_hint: {
    en: "Booked, but the final rate has not gone to the farmer yet.",
    rm: "Booking ho gayi, magar final rate abhi kisan tak nahi gaya.",
    ur: "بکنگ ہو گئی، مگر آخری ریٹ ابھی کسان تک نہیں گیا۔",
  },
  mq_awaiting_confirm: { en: "Waiting for the farmer", rm: "Kisan ka jawab baqi", ur: "کسان کا جواب باقی" },
  mq_awaiting_confirm_hint: {
    en: "The rate has gone; the farmer has not answered yet. No machine goes out until they do.",
    rm: "Rate ja chuka hai, kisan ka jawab nahi aaya. Jawab se pehle machine nahi jati.",
    ur: "ریٹ جا چکا ہے، کسان کا جواب نہیں آیا۔ جواب سے پہلے مشین نہیں جاتی۔",
  },
  mq_dispatch: { en: "Machine to be sent", rm: "Machine bhejni hai", ur: "مشین بھیجنی ہے" },
  mq_dispatch_hint: {
    en: "The farmer has agreed to the rate. Now the machine and driver are decided.",
    rm: "Kisan rate par raazi ho chuka hai. Ab machine aur driver tay hote hain.",
    ur: "کسان ریٹ پر راضی ہو چکا ہے۔ اب مشین اور ڈرائیور طے ہوتے ہیں۔",
  },
  mq_work: { en: "Work to be recorded", rm: "Kaam darj karna hai", ur: "کام درج کرنا ہے" },
  mq_work_hint: {
    en: "The machine has gone out. The bill is made from the actual area — not from the booking.",
    rm: "Machine ja chuki hai. Bill asal raqbe se banta hai, booking se nahi.",
    ur: "مشین جا چکی ہے۔ بل اصل رقبے سے بنتا ہے، بکنگ سے نہیں۔",
  },
  mq_bill: { en: "Bill to be made", rm: "Bill banana hai", ur: "بل بنانا ہے" },
  mq_bill_hint: {
    en: "The work is recorded. Until the bill is made, neither our commission nor the vendor's share exists anywhere.",
    rm: "Kaam darj ho chuka hai. Bill bane baghair na hamara commission kahin hai, na vendor ka hissa.",
    ur: "کام درج ہو چکا ہے۔ بل بنے بغیر نہ ہمارا کمیشن کہیں ہے، نہ وینڈر کا حصہ۔",
  },
  mq_payment: { en: "Money to be collected", rm: "Paisa lena hai", ur: "پیسہ لینا ہے" },
  mq_payment_hint: {
    en: "The bill is made and money is still owed. The booking does not close until it is zero.",
    rm: "Bill ban chuka hai aur paisa baqi hai. Sifar hone tak booking band nahi hoti.",
    ur: "بل بن چکا ہے اور پیسہ باقی ہے۔ صفر ہونے تک بکنگ بند نہیں ہوتی۔",
  },
  mq_week_title: {
    en: "Next 7 days — who is cut on which day",
    rm: "Agle 7 din — kis din kis ki kattai",
    ur: "اگلے 7 دن — کس دن کس کی کٹائی",
  },
  mq_week_overdue: { en: "past their date", rm: "tareekh guzar chuki", ur: "تاریخ گزر چکی" },
  mq_today: { en: "Today", rm: "Aaj", ur: "آج" },
  mq_tomorrow: { en: "Tomorrow", rm: "Kal", ur: "کل" },
  mq_day_free: { en: "free", rm: "khali", ur: "خالی" },
  mq_booked_on: { en: "booked", rm: "booking", ur: "بکنگ" },
  mq_harvest_on: { en: "harvest", rm: "kattai", ur: "کٹائی" },
} as const;
