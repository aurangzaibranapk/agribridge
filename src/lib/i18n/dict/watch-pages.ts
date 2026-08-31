/**
 * Nigrani ke safhe -- sooraakh, ghair-maamooli tarteeb, roz ka milaan,
 * maidan ki nigrani -- aur notifications, testimonials, department.
 *
 * IN SAFHON KI ZABAN JAAN BOOJH KAR NARM RAKHI GAYI HAI. Ye us bande ke
 * baare mein hain jo saamne baitha hai. "Ye ilzam nahi, sawal hai" wala
 * jumla safhe par likha hua hai, aur wo wahin rehna chahiye: nizam ne
 * ek tarteeb dekhi, chori nahi pakri. Farq bara hai, aur jis manager ne
 * ye safha khola hai us ke haath mein kisi ka rozgaar hota hai.
 *
 * "YAHAN AI ISTEMAL NAHI HOTA" bhi qasdan likha hai. Ye safha sirf ginti
 * karta hai -- kaun, kitni dafa, kis waqt. Koi andaza nahi lagata. Ye
 * baat saamne likhi ho to us ke nateeje par bharosa kiya ja sakta hai;
 * na likhi ho to banda samajhta hai ke machine ne raaye di hai.
 *
 * "Naam le kar baat hoti hai" wali rok teenon nigrani wale safhon par ek
 * jaisi hai -- kyunke sab par yehi khatra hai: adhoori baat sun kar
 * koi faisla kar leta hai.
 */
export const watchPagesDict = {
  // ---- Sooraakh ----
  lk_title: { en: "Where the Money Is Leaking", rm: "Paisa kahan se nikal raha hai", ur: "پیسہ کہاں سے نکل رہا ہے" },
  lk_holes: { en: "Leaks — biggest to smallest", rm: "Sooraakh -- bare se chhote tak", ur: "سوراخ — بڑے سے چھوٹے تک" },
  lk_cash_gap_branch: { en: "Cash gap — in which branch", rm: "Naqad ka farq -- kis shakh mein", ur: "نقد کا فرق — کس شاخ میں" },
  lk_short_cash_who: { en: "Short cash — through whose hands", rm: "Kam pahuncha naqad -- kis ke haath se", ur: "کم پہنچا نقد — کس کے ہاتھ سے" },
  lk_found_where_looked: { en: "Where we looked, it came out", rm: "Jahan hum ne dekha, wahan se nikla", ur: "جہاں ہم نے دیکھا، وہاں سے نکلا" },
  lk_named_page: {
    en: "This page is for the owner, admin and finance only — it names people.",
    rm: "Ye safha sirf malik, admin aur finance ke liye hai -- is mein naam le kar baat hoti hai.",
    ur: "یہ صفحہ صرف مالک، ایڈمن اور فنانس کے لیے ہے — اس میں نام لے کر بات ہوتی ہے۔",
  },
  lk_see: { en: "see", rm: "dekhein", ur: "دیکھیں" },
  lk_see_detail: { en: "see detail", rm: "tafseel dekhein", ur: "تفصیل دیکھیں" },
  lk_fix: { en: "fix it", rm: "theek karein", ur: "ٹھیک کریں" },

  // ---- Ghair-maamooli tarteeb ----
  an_title: { en: "Unusual Patterns", rm: "Ghair-maamooli tarteeb", ur: "غیر معمولی ترتیب" },
  an_none: { en: "No unusual pattern is showing.", rm: "Koi ghair-maamooli tarteeb nazar nahi aa rahi.", ur: "کوئی غیر معمولی ترتیب نظر نہیں آ رہی۔" },
  an_seen: { en: "Already looked at", rm: "Jo dekhi ja chuki", ur: "جو دیکھی جا چکی" },
  an_not_accusation: { en: "This is not an accusation, it is a question.", rm: "Ye ilzam nahi, sawal hai.", ur: "یہ الزام نہیں، سوال ہے۔" },
  an_no_ai: { en: "No AI is used here.", rm: "Yahan AI istemal nahi hota.", ur: "یہاں AI استعمال نہیں ہوتا۔" },
  an_other_pages: { en: "The other pages catch where someone", rm: "Baqi safhe wo pakaRte hain jahan kisi ne", ur: "باقی صفحے وہ پکڑتے ہیں جہاں کسی نے" },
  an_broke_rule: { en: "broke a rule", rm: "usool toRa", ur: "اصول توڑا" },
  an_always: { en: "always", rm: "hamesha", ur: "ہمیشہ" },

  // ---- Roz ka milaan ----
  rc_title: { en: "Daily Reconciliation", rm: "Roz ka milaan", ur: "روز کا ملان" },
  rc_none_yet: { en: "No check has run yet", rm: "Abhi koi jaanch nahi hui", ur: "ابھی کوئی جانچ نہیں ہوئی" },
  rc_all_passed: { en: "Nothing is open — every check passed.", rm: "Koi baat khuli nahi -- har jaanch guzar gayi.", ur: "کوئی بات کھلی نہیں — ہر جانچ گزر گئی۔" },
  rc_previous_days: { en: "Previous days", rm: "Pichhle din", ur: "پچھلے دن" },

  // ---- Maidan ki nigrani ----
  fw_title: { en: "Field Watch", rm: "Maidan ki nigrani", ur: "میدان کی نگرانی" },
  fw_none: { en: "Nothing needs attention right now", rm: "Filhal koi cheez tawajjah nahi mangti", ur: "فی الحال کوئی چیز توجہ نہیں مانگتی" },
  fw_urgent: { en: "Needs attention now", rm: "Fauri tawajjah", ur: "فوری توجہ" },
  fw_have_a_look: { en: "Have a look", rm: "Dekh lein", ur: "دیکھ لیں" },
  fw_only_manager: { en: "This page is for the manager and admin only.", rm: "Ye safha sirf manager aur admin ke liye hai.", ur: "یہ صفحہ صرف منیجر اور ایڈمن کے لیے ہے۔" },

  // ---- Notifications ----
  nt_mine: { en: "My Notifications", rm: "Meri ittilaat", ur: "میری اطلاعات" },
  nt_all_activity: { en: "Everyone's Activity", rm: "Sab ki activity", ur: "سب کی سرگرمی" },
  nt_none: { en: "No notifications.", rm: "Koi ittila nahi.", ur: "کوئی اطلاع نہیں۔" },
  nt_send_announcement: { en: "Send Announcement", rm: "Elaan bhejein", ur: "اعلان بھیجیں" },
  nt_write_message: { en: "Write the message", rm: "Paighaam likhein", ur: "پیغام لکھیں" },
  nt_mark_read: { en: "Mark as read", rm: "Parh liya", ur: "پڑھ لیا" },
  nt_all_shops: { en: "All shops / branches", rm: "Sab dukanein / shakhein", ur: "سب دکانیں / شاخیں" },
  nt_all_staff_hq: { en: "All staff (HQ departments)", rm: "Sab staff (HQ ke shobe)", ur: "سب عملہ (HQ کے شعبے)" },

  // ---- Testimonials ----
  ts_new: { en: "New Testimonial", rm: "Nayi raaye", ur: "نئی رائے" },
  ts_name_req: { en: "Name *", rm: "Naam *", ur: "نام *" },
  ts_quote_req: { en: "Quote *", rm: "Us ke apne alfaz *", ur: "اس کے اپنے الفاظ *" },
  ts_rating: { en: "Rating (1-5)", rm: "Darja (1-5)", ur: "درجہ (1-5)" },
  ts_photo_url: { en: "Photo URL", rm: "Tasveer ka pata", ur: "تصویر کا پتہ" },
  ts_location_eg: { en: "Jhang · wheat farmer", rm: "Jhang · gandum ka kisan", ur: "جھنگ · گندم کا کسان" },

  // ---- Department ----
  dp_title: { en: "Departments & Permissions", rm: "Shobe aur ijazatein", ur: "شعبے اور اجازتیں" },
  dp_head: { en: "Department Head", rm: "Shobe ka sarbarah", ur: "شعبے کا سربراہ" },
  dp_temp_permission: { en: "Temporary Permission", rm: "Waqti ijazat", ur: "وقتی اجازت" },

  // ---- Audit ke sirnaame ----
  ra_manual_loss: {
    en: "Manual Loss Reports (damage / theft / shrinkage / other)",
    rm: "Haath se darj nuqsan (toot phoot / chori / kami / deegar)",
    ur: "ہاتھ سے درج نقصان (ٹوٹ پھوٹ / چوری / کمی / دیگر)",
  },
  ra_expiry_tracking: {
    en: "Expiry Tracking (warning 30 days ahead, then loss)",
    rm: "Khatam hone par nazar (tees din pehle chetawni, phir nuqsan)",
    ur: "ختم ہونے پر نظر (تیس دن پہلے چتاونی، پھر نقصان)",
  },
  ra_slow_moving_full: { en: "Slow-Moving Stock (not sold in 90+ days)", rm: "Para hua stock (nawwe din se bika nahi)", ur: "پڑا ہوا اسٹاک (نوے دن سے بکا نہیں)" },
  ra_no_slow_moving: { en: "No slow-moving stock — everything is selling well.", rm: "Koi stock para hua nahi -- sab acha bik raha hai.", ur: "کوئی اسٹاک پڑا ہوا نہیں — سب اچھا بک رہا ہے۔" },
  ra_grn_disc: { en: "GRN Discrepancies (AgriBridge orders)", rm: "GRN ke farq (AgriBridge ke order)", ur: "GRN کے فرق (ایگری برج کے آرڈر)" },
  ra_delivery_disc: { en: "Delivery Discrepancies (short / damaged on arrival)", rm: "Delivery ke farq (kam ya toota hua mila)", ur: "ڈیلیوری کے فرق (کم یا ٹوٹا ہوا ملا)" },
  ra_transfer_disc: { en: "Stock Transfer Discrepancies", rm: "Stock transfer ke farq", ur: "اسٹاک ٹرانسفر کے فرق" },
  ra_see: { en: "see.", rm: "dekhein.", ur: "دیکھیں۔" },
} as const;
