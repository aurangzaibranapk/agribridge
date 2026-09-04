/**
 * Raat ki cash ginti ke alfaz.
 *
 * Istilahat glossary.ts se: naqad, shakh, tareekh, wajah, ginti, baqi,
 * kharch, ledger, farq.
 *
 * "KAM" aur "ZYADA" bare harfon mein rehte hain -- ye ginne wale ke
 * liye sab se ahem lafz hai aur screen par foran nazar aana chahiye.
 *
 * "Cash ka farq" khate ka naam hai (6100), lafz nahi -- iska tarjuma
 * karne se khate ka naam badal jata, is liye jyon ka tyon rakha gaya.
 */
export const cashCloseDict = {
  ccash_title: { en: "Nightly Cash Count", rm: "Raat ki Cash Ginti", ur: "رات کی کیش گنتی" },
  ccash_subtitle: {
    en: "The ledger says how much there should be. The count says how much there is. The difference is recorded right there — it does not get hidden.",
    rm: "Ledger batata hai kitna hona chahiye. Ginti batati hai kitna hai. Farq wahin darj hota hai — chhupta nahi.",
    ur: "لیجر بتاتا ہے کتنا ہونا چاہیے۔ گنتی بتاتی ہے کتنا ہے۔ فرق وہیں درج ہوتا ہے — چھپتا نہیں۔",
  },
  cc_all_done: { en: "Every branch has been counted today", rm: "Aaj sab branches ki ginti ho chuki hai", ur: "آج سب شاخوں کی گنتی ہو چکی ہے" },
  cc_pending_count: { en: "branch counts are still due today", rm: "branch ki aaj ki ginti baqi hai", ur: "شاخ کی آج کی گنتی باقی ہے" },
  cc_orphan_cash: {
    en: "is cash that is not recorded under any branch.",
    rm: "aisa cash hai jo kisi branch ke naam darj nahi.",
    ur: "ایسا کیش ہے جو کسی شاخ کے نام درج نہیں۔",
  },
  cc_orphan_note: {
    en: "Each branch counts only its own cash, so this amount never lands in anyone's count — meaning no difference is ever found on it. Until this is zero, the day's count is not complete.",
    rm: "Har branch sirf apna cash ginti hai, is liye ye raqam kisi ki bhi ginti mein nahi aati — yani is par kabhi farq nahi nikalta. Jab tak ye sifar nahi hota, roz ki ginti poori nahi kehlati.",
    ur: "ہر شاخ صرف اپنا کیش گنتی ہے، اس لیے یہ رقم کسی کی بھی گنتی میں نہیں آتی — یعنی اس پر کبھی فرق نہیں نکلتا۔ جب تک یہ صفر نہیں ہوتا، روز کی گنتی پوری نہیں کہلاتی۔",
  },
  cc_no_branch: { en: "No branch found", rm: "Koi branch nahi mili", ur: "کوئی شاخ نہیں ملی" },
  cc_no_branch_note: {
    en: "First create a branch under Admin → Branches.",
    rm: "Pehle Admin → Branches mein branch banayein.",
    ur: "پہلے ایڈمن ← شاخیں میں شاخ بنائیں۔",
  },
  cc_manager_only: {
    en: "The branch manager does the counting. You can only view here — if the same person counts and checks, checking means nothing.",
    rm: "Ginti branch manager karta hai. Aap yahan sirf dekh sakte hain — ginne wala aur jaanchne wala ek shakhs ho to jaanch ka koi matlab nahi rehta.",
    ur: "گنتی شاخ کا منیجر کرتا ہے۔ آپ یہاں صرف دیکھ سکتے ہیں — گننے والا اور جانچنے والا ایک شخص ہو تو جانچ کا کوئی مطلب نہیں رہتا۔",
  },
  cc_missed_days: { en: "Days the cash moved but no count was taken", rm: "Jin dinon cash hila magar ginti nahi hui", ur: "جن دنوں کیش ہلا مگر گنتی نہیں ہوئی" },
  cc_no_missed: { en: "No day was missed — the last 30 days are complete.", rm: "Koi din chhoota nahi — pichhle 30 din poore hain.", ur: "کوئی دن چھوٹا نہیں — پچھلے ۳۰ دن پورے ہیں۔" },
  cc_missed_note: {
    en: "On a day with no count, the difference will never be known. This list should be empty.",
    rm: "Jis din ginti nahi hui, us din ka farq kabhi maloom nahi hoga. Ye fehrist khali honi chahiye.",
    ur: "جس دن گنتی نہیں ہوئی، اس دن کا فرق کبھی معلوم نہیں ہوگا۔ یہ فہرست خالی ہونی چاہیے۔",
  },
  cc_past_counts: { en: "Past counts", rm: "Pichhli gintiyan", ur: "پچھلی گنتیاں" },
  cc_no_counts: { en: "No count has been taken yet.", rm: "Abhi koi ginti nahi hui.", ur: "ابھی کوئی گنتی نہیں ہوئی۔" },
  cc_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  cc_branch: { en: "Branch", rm: "Branch", ur: "شاخ" },
  cc_expected: { en: "Should be", rm: "Hona chahiye", ur: "ہونا چاہیے" },
  cc_counted: { en: "Counted", rm: "Gina gaya", ur: "گنا گیا" },
  cc_difference: { en: "Difference", rm: "Farq", ur: "فرق" },
  cc_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  cc_footer_note: {
    en: 'The difference always goes to the "Cash difference" (6100) account — it is never adjusted into some expense. Even small differences keep piling up there, so that a question can be asked at month end.',
    rm: 'Farq hamesha "Cash ka farq" (6100) khate mein jata hai — kisi kharche mein adjust nahi hota. Chhota chhota farq bhi wahin jama hota rehta hai, taake mahine ke aakhir mein us par sawal kiya ja sake.',
    ur: 'فرق ہمیشہ "کیش کا فرق" (6100) کھاتے میں جاتا ہے — کسی خرچ میں ایڈجسٹ نہیں ہوتا۔ چھوٹا چھوٹا فرق بھی وہیں جمع ہوتا رہتا ہے، تاکہ مہینے کے آخر میں اس پر سوال کیا جا سکے۔',
  },

  // --- Ginti ka form ---
  cc_recording: { en: "Recording…", rm: "Darj ho rahi hai…", ur: "درج ہو رہی ہے…" },
  cc_already_counted: { en: "Today's count has already been done —", rm: "Aaj ki ginti pehle ho chuki hai —", ur: "آج کی گنتی پہلے ہو چکی ہے —" },
  cc_already_counted_note: {
    en: "The old count will not be erased. The new count appears alongside it, so it stays known what was counted the first time.",
    rm: "Purani ginti mitegi nahi. Nayi ginti us ke sath nazar aayegi, taake ye maloom rahe ke pehli baar kya gina gaya tha.",
    ur: "پرانی گنتی مٹے گی نہیں۔ نئی گنتی اس کے ساتھ نظر آئے گی، تاکہ یہ معلوم رہے کہ پہلی بار کیا گنا گیا تھا۔",
  },
  cc_why_recount: { en: "Why are you counting again?", rm: "Dobara kyun gin rahe hain?", ur: "دوبارہ کیوں گن رہے ہیں؟" },
  cc_required: { en: "(required)", rm: "(lazmi)", ur: "(لازمی)" },
  cc_recount_reason_eg: {
    en: "e.g. A Rs 1000 stack was left out of the first count",
    rm: "Jaise: pehli ginti mein Rs 1000 ka dher reh gaya tha",
    ur: "جیسے: پہلی گنتی میں 1000 روپے کا ڈھیر رہ گیا تھا",
  },
  cc_count_notes_coins: { en: "Count the notes and coins", rm: "Note aur sikkay ginein", ur: "نوٹ اور سکے گنیں" },
  cc_system_says: { en: "The system says it should be", rm: "System ke mutabiq hona chahiye", ur: "سسٹم کے مطابق ہونا چاہیے" },
  cc_no_difference: { en: "No difference — the account matched in full.", rm: "Farq koi nahi — hisaab poora mila.", ur: "فرق کوئی نہیں — حساب پورا ملا۔" },
  cc_short: { en: "SHORT", rm: "KAM", ur: "کم" },
  cc_over: { en: "OVER", rm: "ZYADA", ur: "زیادہ" },
  cc_came_out: { en: "came out.", rm: "nikle hain.", ur: "نکلے ہیں۔" },
  cc_difference_note: {
    en: 'This difference will be recorded in the "Cash difference" account. It will not be hidden inside some expense — it can be asked about at month end.',
    rm: 'Ye farq "Cash ka farq" khate mein darj hoga. Kisi kharche mein chhupaya nahi jayega — mahine ke aakhir mein poochha ja sakega.',
    ur: 'یہ فرق "کیش کا فرق" کھاتے میں درج ہوگا۔ کسی خرچ میں چھپایا نہیں جائے گا — مہینے کے آخر میں پوچھا جا سکے گا۔',
  },
  cc_what_happened: { en: "What do you make of it?", rm: "Kya samajh aaya?", ur: "کیا سمجھ آیا؟" },
  cc_difference_reason_eg: {
    en: "e.g. A Rs 500 expense in the evening was not written down",
    rm: "Jaise: shaam ko Rs 500 ka kharcha likhna reh gaya tha",
    ur: "جیسے: شام کو 500 روپے کا خرچہ لکھنا رہ گیا تھا",
  },
  cc_unknown_reason_note: {
    en: 'If the reason is not known, write exactly that — "reason not known yet". Writing half a truth is worse than this.',
    rm: 'Wajah maloom na ho to wahi likhein — "wajah abhi maloom nahi". Adha sach likhna is se bura hai.',
    ur: 'وجہ معلوم نہ ہو تو وہی لکھیں — "وجہ ابھی معلوم نہیں"۔ آدھا سچ لکھنا اس سے برا ہے۔',
  },
  cc_other_notes: { en: "Anything else (optional)", rm: "Koi aur baat (marzi)", ur: "کوئی اور بات (مرضی)" },
  cc_record_recount: { en: "Record the recount", rm: "Dobara ginti darj karein", ur: "دوبارہ گنتی درج کریں" },
  cc_record_count: { en: "Record the count", rm: "Ginti darj karein", ur: "گنتی درج کریں" },
  cc_immutable_note: {
    en: "Once recorded, a count cannot be changed — this rule is in the database.",
    rm: "Ginti darj hone ke baad badli nahi ja sakti — ye rok database mein hai.",
    ur: "گنتی درج ہونے کے بعد بدلی نہیں جا سکتی — یہ روک ڈیٹابیس میں ہے۔",
  },
} as const;
