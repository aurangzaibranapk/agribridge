/**
 * Owner Command Center, audit trail, cheezon ki ijazatein, gallery,
 * FAQ, aur AI ke mashware.
 *
 * AUDIT TRAIL PAR "YE KHUD EK REVERSAL HAI" wala jumla qasdan hai:
 * reversal ka reversal nahi hota. Bina us ke banda usi qatar par dobara
 * "ulta karein" dhoondta hai aur na milne par samajhta hai ke nizam
 * mein kharabi hai.
 *
 * CHEEZON KI IJAZATON MEIN "DELETE" KE SAATH SAAF LIKHA HAI ke ye kabhi
 * kisi ko na dein. Ye sirf mashwara nahi -- cheez mit jane ka matlab hai
 * us se juRa poora hisaab bemaani ho jana, aur wo ghalti wapas nahi
 * hoti. Us jumle ka wahan hona hi asal pehra hai, kyunke tick lagane
 * wala banda wahin khaRa hota hai.
 *
 * "Approval ke baad hi live hoga" har ijazat ke saath dohraya gaya hai.
 * Do alag ijazatein hain (nayi cheez tajweez karna, aur maujooda mein
 * tabdeeli), aur donon jagah banda ye jaan le ke us ka kaam foran nafiz
 * nahi hota.
 */
export const ownerToolsDict = {
  // ---- Command Center ----
  cc_title: { en: "Owner Command Center", rm: "Malik ka command center", ur: "مالک کا کمانڈ سینٹر" },
  cc_today: { en: "Today", rm: "Aaj", ur: "آج" },
  cc_income: { en: "Income", rm: "Aamdani", ur: "آمدنی" },
  cc_cost: { en: "Cost / Expense", rm: "Lagat / kharcha", ur: "لاگت / خرچہ" },
  cc_profit: { en: "Profit", rm: "Nafa", ur: "نفع" },
  cc_result: { en: "Result", rm: "Nateeja", ur: "نتیجہ" },
  cc_work: { en: "Work", rm: "Kaam", ur: "کام" },
  cc_attention: { en: "Needs attention", rm: "Tawajjah chahiye", ur: "توجہ چاہیے" },
  cc_dept_this_month: { en: "Department — this month", rm: "Department -- is mahine", ur: "شعبہ — اس مہینے" },
  cc_shop_pl: { en: "Shop-wise P&L", rm: "Dukan dukan ka nafa nuqsan", ur: "دکان دکان کا نفع نقصان" },
  cc_direct_cost: { en: "Direct cost", rm: "Seedhi lagat", ur: "سیدھی لاگت" },
  cc_other_expense: { en: "Other expense", rm: "Baqi kharcha", ur: "باقی خرچہ" },
  cc_profit_loss: { en: "Profit / Loss", rm: "Nafa / nuqsan", ur: "نفع / نقصان" },
  cc_margin: { en: "Margin %", rm: "Margin %", ur: "مارجن %" },
  cc_attention_col: { en: "Pending / Attention", rm: "Baqi / tawajjah", ur: "باقی / توجہ" },
  cc_total_revenue: { en: "Total revenue", rm: "Kul aamdani", ur: "کل آمدنی" },
  cc_total_cost: { en: "Total cost", rm: "Kul lagat", ur: "کل لاگت" },
  cc_net: { en: "Net profit / loss", rm: "Saaf nafa / nuqsan", ur: "صاف نفع / نقصان" },
  cc_needs_attention_count: { en: "Needs attention", rm: "Tawajjah chahiye", ur: "توجہ چاہیے" },
  cc_insight: { en: "AgriBridge AI Insight", rm: "AgriBridge AI ki raye", ur: "ایگری برج AI کی رائے" },
  cc_incomplete: { en: "Data incomplete", rm: "Hisaab adhoora", ur: "حساب ادھورا" },
  cc_untracked: { en: "Not tracked", rm: "Track nahi hoti", ur: "ٹریک نہیں ہوتی" },
  // ---- Kaam ka haath badalna ----
  wd_sent_to: { en: "Sent to", rm: "Khabar gayi", ur: "خبر گئی" },
  wd_open: { en: "Open", rm: "Kholein", ur: "کھولیں" },
  wd_my_work: { en: "Work waiting for you", rm: "Aap ke zimme kaam", ur: "آپ کے ذمے کام" },
  wd_my_name: { en: "Your name is on it", rm: "Aap ka naam laga hai", ur: "آپ کا نام لگا ہے" },
  wd_none: { en: "Nothing has been handed to you.", rm: "Aap ke zimme abhi koi kaam nahi.", ur: "آپ کے ذمے ابھی کوئی کام نہیں۔" },

  // ---- POS counter ----
  pos_all_groups: { en: "All groups", rm: "Sab qismein", ur: "سب قسمیں" },
  pos_cust_search: { en: "Search by name or phone", rm: "Naam ya phone se dhoondein", ur: "نام یا فون سے ڈھونڈیں" },
  pos_cust_none: { en: "No customer found by that name or phone.", rm: "Is naam ya phone se koi gahak nahi mila.", ur: "اس نام یا فون سے کوئی گاہک نہیں ملا۔" },
  pos_cust_balance: { en: "Balance", rm: "Us par baqi", ur: "اس پر باقی" },
  pos_walk_in_hint: {
    en: "Leave empty for a walk-in customer.",
    rm: "Aam gahak ho to khali chhoR dein.",
    ur: "عام گاہک ہو تو خالی چھوڑ دیں۔",
  },

  // ---- Counter ka naya naqsha (cheez ki tafseel) ----
  pos_details: { en: "Item Details", rm: "Cheez ki tafseel", ur: "چیز کی تفصیل" },
  pos_pick_from_cart: {
    en: "Tap an item in the cart to see its details.",
    rm: "Tafseel dekhne ke liye cart se cheez par dabayein.",
    ur: "تفصیل دیکھنے کے لیے کارٹ سے چیز پر دبائیں۔",
  },
  pos_cart_empty_hint: {
    en: "Pick a product or scan a barcode.",
    rm: "Cheez chunein ya barcode scan karein.",
    ur: "چیز چنیں یا بارکوڈ اسکین کریں۔",
  },
  pos_sell_rate: { en: "Selling rate", rm: "Bikri ka rate", ur: "بکری کا ریٹ" },
  pos_mrp: { en: "MRP", rm: "MRP", ur: "MRP" },
  // Thok ka rate = jis par THOK WALI DUKAN ko bikta hai. Ye "trade
  // rate" ka wo matlab nahi jo bill par kharid ke rate ke liye chalta
  // hai -- wo alag khana hai (kharid ka rate) aur alag ijazat maangta
  // hai. Do alag cheezon ka ek naam rakhne se counter par ghalat adad
  // parha jata hai.
  pos_wholesale_rate: { en: "Wholesale rate", rm: "Thok ka rate", ur: "تھوک کا ریٹ" },
  pos_cost_rate: { en: "Purchase rate", rm: "Kharid ka rate", ur: "خرید کا ریٹ" },
  pos_shop_stock: { en: "Shop stock", rm: "Dukan par maal", ur: "دکان پر مال" },
  pos_wh_stock: { en: "Warehouse stock", rm: "Godam mein maal", ur: "گودام میں مال" },
  pos_barcode: { en: "Barcode", rm: "Barcode", ur: "بارکوڈ" },
  pos_batch: { en: "Batch", rm: "Batch", ur: "بیچ" },
  pos_batch_many: { en: "{n} batches together", rm: "{n} batch mile hue", ur: "{n} بیچ ملے ہوئے" },
  pos_expiry: { en: "Expiry", rm: "Miyaad", ur: "میعاد" },
  pos_line_total: { en: "Line total", rm: "Is qatar ka jama", ur: "اس قطار کا جمع" },
  pos_remove_item: { en: "Remove item", rm: "Ye cheez hatayein", ur: "یہ چیز ہٹائیں" },
  pos_rate_locked: {
    en: "You are not allowed to change the rate.",
    rm: "Rate badalne ki ijazat aap ke paas nahi.",
    ur: "ریٹ بدلنے کی اجازت آپ کے پاس نہیں۔",
  },
  pos_not_tracked: { en: "not tracked", rm: "hisaab nahi rakha jata", ur: "حساب نہیں رکھا جاتا" },
  pos_no_barcode: { en: "no barcode yet", rm: "barcode abhi nahi laga", ur: "بارکوڈ ابھی نہیں لگا" },
  pos_stock_out: { en: "Finished", rm: "Khatam", ur: "ختم" },
  pos_categories: { en: "Categories", rm: "Qismein", ur: "قسمیں" },
  pos_all_items: { en: "All items", rm: "Sab cheezein", ur: "سب چیزیں" },
  pos_no_name: { en: "name missing", rm: "naam nahi aaya", ur: "نام نہیں آیا" },
  pos_subtotal: { en: "Subtotal", rm: "Jama", ur: "جمع" },
  pos_paid: { en: "Paid", rm: "Diya gaya", ur: "دیا گیا" },
  pos_wholesale_needs_shop: {
    en: "Pick the registered shop or dealer for a wholesale sale.",
    rm: "Thok ki bikri par darj shuda dukan ya dealer chunein.",
    ur: "تھوک کی بکری پر درج شدہ دکان یا ڈیلر چنیں۔",
  },
  pos_credit_left: { en: "Credit still open", rm: "Udhaar abhi khula", ur: "ادھار ابھی کھلا" },
  pos_details_done: { en: "Done", rm: "Theek hai", ur: "ٹھیک ہے" },

  // ---- Gahak ki teen qismein, aur udhaar ka usool ----
  pos_walkin: { en: "Walk-in", rm: "Chalta gahak", ur: "چلتا گاہک" },
  pos_regular: { en: "Regular Customer", rm: "Darj shuda gahak", ur: "درج شدہ گاہک" },
  pos_wholesale: { en: "Wholesale / Shop", rm: "Thok / dukan", ur: "تھوک / دکان" },
  pos_walkin_note: {
    en: "Cash customer — no customer record needed.",
    rm: "Naqad gahak — naam likhne ki zaroorat nahi.",
    ur: "نقد گاہک — نام لکھنے کی ضرورت نہیں۔",
  },
  pos_walkin_no_credit: {
    en: "Walk-in sales cannot go on khata.",
    rm: "Chalte gahak par khata nahi chalta.",
    ur: "چلتے گاہک پر کھاتہ نہیں چلتا۔",
  },
  pos_credit_needs_customer: {
    en: "Select a registered customer for a credit sale.",
    rm: "Udhaar sale ke liye darj shuda gahak chunein.",
    ur: "ادھار سیل کے لیے درج شدہ گاہک چنیں۔",
  },
  pos_credit_limit: { en: "Credit limit", rm: "Udhaar ki hadd", ur: "ادھار کی حد" },
  pos_shop_search: {
    en: "Search shop, dealer, mobile or ID",
    rm: "Dukan, dealer, phone ya ID se dhoondein",
    ur: "دکان، ڈیلر، فون یا آئی ڈی سے ڈھونڈیں",
  },
  pos_credit_over_limit: {
    en: "This would cross the customer's credit limit.",
    rm: "Is se gahak ki udhaar ki hadd tuT jayegi.",
    ur: "اس سے گاہک کی ادھار کی حد ٹوٹ جائے گی۔",
  },

  // ---- Ghanti (notification bell) ----
  nbell_title: { en: "Notifications", rm: "Ittila-aat", ur: "اطلاعات" },
  nbell_unread: { en: "New", rm: "Nayi", ur: "نئی" },
  nbell_read: { en: "Already read", rm: "Parh li hui", ur: "پڑھی ہوئی" },
  nbell_none: { en: "No notifications yet.", rm: "Abhi koi ittila nahi.", ur: "ابھی کوئی اطلاع نہیں۔" },
  nbell_mark_all: { en: "Mark all read", rm: "Sab parh liye", ur: "سب پڑھ لیے" },
  nbell_see_all: { en: "See all", rm: "Sab dekhein", ur: "سب دیکھیں" },
  nbell_loading: { en: "Loading…", rm: "Aa rahi hain…", ur: "آ رہی ہیں…" },

  // ---- Command Center: kaam ke chips ----
  // Ye alfaz adad ke SAATH lagte hain ("Jama 120 L"), is liye teenon
  // zabanon mein aise likhe gaye hain ke adad un ke baad theek baithe.
  cc_w_collected: { en: "Collected", rm: "Jama", ur: "جمع" },
  cc_w_shortage: { en: "Shortage", rm: "Kami", ur: "کمی" },
  cc_w_farmer_payable: { en: "Farmer payable", rm: "Kisan ko dena", ur: "کسان کو دینا" },
  cc_w_bought: { en: "Bought", rm: "Kharida", ur: "خریدا" },
  cc_w_sold: { en: "Sold", rm: "Bika", ur: "بکا" },
  cc_w_in_store: { en: "In store", rm: "Godam", ur: "گودام" },
  cc_w_bookings: { en: "Bookings", rm: "Booking", ur: "بکنگ" },
  cc_w_completed: { en: "Completed", rm: "Mukammal", ur: "مکمل" },
  cc_w_acres: { en: "Acres", rm: "Acre", ur: "ایکڑ" },
  cc_w_sales: { en: "Sales", rm: "Bikri", ur: "بکری" },
  cc_w_returns: { en: "Returned", rm: "Wapsi", ur: "واپسی" },
  cc_w_waiting: { en: "Waiting", rm: "Intezar mein", ur: "انتظار میں" },

  // ---- Command Center: har department ke neeche wali baat ----
  cc_n_milk: {
    en: "Revenue is the service rate per litre. Money paid to farmers passes through — it is not part of this profit and loss.",
    rm: "Aamdani service rate (fi litre) se banti hai. Kisan ka doodh guzarne wali raqam hai, is nafa nuqsan ka hissa nahi.",
    ur: "آمدنی فی لیٹر سروس ریٹ سے بنتی ہے۔ کسان کو دی جانے والی رقم گزرنے والی رقم ہے، اس نفع نقصان کا حصہ نہیں۔",
  },
  cc_n_milk_no_rate: {
    en: "The company billing service rate is not set yet — without it milk revenue cannot be computed.",
    rm: "Company billing ka service rate abhi set nahi -- us ke baghair doodh ki aamdani nahi banti.",
    ur: "کمپنی بلنگ کا سروس ریٹ ابھی مقرر نہیں — اس کے بغیر دودھ کی آمدنی نہیں بنتی۔",
  },
  cc_n_grain: {
    en: "Cost covers only what was SOLD; grain sitting in the store has not become a cost yet.",
    rm: "Lagat sirf BIKE hue maal ki hai; jo godam mein para hai wo abhi lagat nahi bana.",
    ur: "لاگت صرف بکے ہوئے مال کی ہے؛ جو گودام میں پڑا ہے وہ ابھی لاگت نہیں بنا۔",
  },
  cc_n_grain_unsold: {
    en: "Grain was bought this month but not sold — it is in the store. That is stock, not a loss.",
    rm: "Is mahine anaj khareeda gaya magar bika nahi -- wo godam mein hai, nuqsan nahi.",
    ur: "اس مہینے اناج خریدا گیا مگر بکا نہیں — وہ گودام میں ہے، نقصان نہیں۔",
  },
  cc_n_machinery: {
    en: "Our revenue is the commission, not gross billing. Only diesel we paid for counts as cost — recoverable diesel does not.",
    rm: "Hamari aamdani commission hai, gross billing nahi. Diesel mein sirf hamara apna kharcha gina gaya -- wapas aane wala diesel kharcha nahi.",
    ur: "ہماری آمدنی کمیشن ہے، گراس بلنگ نہیں۔ ڈیزل میں صرف ہمارا اپنا خرچہ گنا گیا — واپس آنے والا ڈیزل خرچہ نہیں۔",
  },
  cc_n_retail: {
    en: "Expenses are not kept per department, so other expense is not tracked here.",
    rm: "Kharche department ke hisaab se alag nahi rakhe jate, is liye baqi kharcha yahan track nahi hota.",
    ur: "خرچے شعبے کے حساب سے الگ نہیں رکھے جاتے، اس لیے باقی خرچہ یہاں ٹریک نہیں ہوتا۔",
  },
  cc_n_approval: {
    en: "This department earns nothing — it is a queue. It has no profit or loss.",
    rm: "Ye department paisa nahi kamata -- ye qatar hai. Is ka koi nafa nuqsan nahi hota.",
    ur: "یہ شعبہ پیسہ نہیں کماتا — یہ قطار ہے۔ اس کا کوئی نفع نقصان نہیں ہوتا۔",
  },
  cc_n_read_failed: {
    en: "This department's records could not be read right now ({err}). These figures are incomplete — do not read them as correct.",
    rm: "Is department ka record is waqt parha nahi ja saka ({err}). Ye adad adhoore hain -- inhen sahi na samjhein.",
    ur: "اس شعبے کا ریکارڈ اس وقت پڑھا نہیں جا سکا ({err})۔ یہ اعداد ادھورے ہیں — انہیں درست نہ سمجھیں۔",
  },

  // ---- Command Center: ruka hua kaam (adad in se PEHLE lagta hai) ----
  cc_p_fat: {
    en: "entries awaiting FAT verification",
    rm: "entry FAT ki tasdeeq ke intezar mein",
    ur: "اندراج فیٹ کی تصدیق کے انتظار میں",
  },
  cc_p_unbilled: {
    en: "completed bookings not billed yet",
    rm: "mukammal booking ka bill abhi nahi bana",
    ur: "مکمل بکنگ کا بل ابھی نہیں بنا",
  },
  cc_p_returns: { en: "returns awaiting a decision", rm: "wapsi faisle ke intezar mein", ur: "واپسی فیصلے کے انتظار میں" },
  cc_p_approvals: { en: "entries awaiting approval", rm: "entry manzoori ke intezar mein", ur: "اندراج منظوری کے انتظار میں" },

  // ---- Command Center: AI ki raye ----
  cc_i_incomplete: {
    en: "**{dept}** profit cannot be computed: {why}",
    rm: "**{dept}** ka nafa nahi nikal raha: {why}",
    ur: "**{dept}** کا نفع نہیں نکل رہا: {why}",
  },
  cc_i_note: { en: "**{dept}**: {why}", rm: "**{dept}**: {why}", ur: "**{dept}**: {why}" },
  cc_i_too_early: {
    en: "Not enough has happened this month to compare departments.",
    rm: "Is mahine abhi itna kaam nahi hua ke departments ka moqabla kiya ja sake.",
    ur: "اس مہینے ابھی اتنا کام نہیں ہوا کہ شعبوں کا مقابلہ کیا جا سکے۔",
  },
  cc_i_best: {
    en: "Best: **{dept}** — {profit} profit on {revenue} of revenue{margin}.",
    rm: "Sab se behtar: **{dept}** — {profit} nafa, {revenue} ki aamdani par{margin}.",
    ur: "سب سے بہتر: **{dept}** — {profit} نفع، {revenue} کی آمدنی پر{margin}۔",
  },
  cc_i_worst: {
    en: "Lowest: **{dept}** — {margin} margin. Cost is {cost}; that is what holds the profit down.",
    rm: "Sab se kam: **{dept}** — margin {margin}. Lagat {cost} hai; nafa isi se dabta hai.",
    ur: "سب سے کم: **{dept}** — مارجن {margin}۔ لاگت {cost} ہے؛ نفع اسی سے دبتا ہے۔",
  },
  cc_i_pending: { en: "**{dept}**: {why}.", rm: "**{dept}**: {why}.", ur: "**{dept}**: {why}۔" },

  // ---- Command Center: aaj ke paanch adad aur do jumle ----
  cc_t_sales: { en: "Sales today", rm: "Aaj ki bikri", ur: "آج کی بکری" },
  cc_t_expenses: { en: "Expenses today", rm: "Aaj ke kharche", ur: "آج کے خرچے" },
  cc_t_profit: { en: "Profit today", rm: "Aaj ka nafa", ur: "آج کا نفع" },
  cc_t_cash: { en: "In the accounts", rm: "Khaton mein maujood", ur: "کھاتوں میں موجود" },
  cc_t_receivable: { en: "To be recovered", rm: "Wusool karna hai", ur: "وصول کرنا ہے" },
  cc_subtitle: {
    en: "Today's money, how each department is doing, and what needs attention.",
    rm: "Aaj ka paisa, har department ka moqabla, aur wo cheezein jo tawajjah mangti hain.",
    ur: "آج کا پیسہ، ہر شعبے کا مقابلہ، اور وہ چیزیں جو توجہ مانگتی ہیں۔",
  },
  cc_excluded: {
    en: "{names} not included — their figures are incomplete.",
    rm: "{names} shaamil nahi — un ka hisaab adhoora hai.",
    ur: "{names} شامل نہیں — ان کا حساب ادھورا ہے۔",
  },
  cc_from_books: {
    en: "This is worked out from your own books — nothing is guessed. What the books do not show is not written here either.",
    rm: "Ye nateeja aap ke apne khaton se ginam kar nikala gaya hai — koi andaza nahi. Jo baat khaton se nahi nikalti, wo yahan likhi bhi nahi jati.",
    ur: "یہ نتیجہ آپ کے اپنے کھاتوں سے گن کر نکالا گیا ہے — کوئی اندازہ نہیں۔ جو بات کھاتوں سے نہیں نکلتی، وہ یہاں لکھی بھی نہیں جاتی۔",
  },

  cc_only_complete: {
    en: "Totals include only departments whose financial data is complete.",
    rm: "In totals mein sirf wo departments hain jin ka maali hisaab poora hai.",
    ur: "ان ٹوٹلز میں صرف وہ شعبے ہیں جن کا مالی حساب پورا ہے۔",
  },

  // ---- Audit trail ----
  aud_title: { en: "Who Did What", rm: "Kis ne kya kiya", ur: "کس نے کیا کیا" },
  at_recent: { en: "Recent entries", rm: "Haal ki qatarein", ur: "حال کی قطاریں" },
  at_other_actions: { en: "Record of other actions", rm: "Baqi kaamon ka record", ur: "باقی کاموں کا ریکارڈ" },
  at_no_entry: { en: "No entries yet.", rm: "Abhi koi qatar nahi.", ur: "ابھی کوئی قطار نہیں۔" },
  at_no_record: { en: "No record yet.", rm: "Abhi koi record nahi.", ur: "ابھی کوئی ریکارڈ نہیں۔" },
  at_entry: { en: "Entry", rm: "Qatar", ur: "قطار" },
  at_who: { en: "Who", rm: "Kis ne", ur: "کس نے" },
  at_kind: { en: "Kind", rm: "Qism", ur: "قسم" },
  at_reversed: { en: "reversed", rm: "ulti gayi", ur: "الٹی گئی" },
  at_backdated: { en: "back-dated", rm: "purani tareekh", ur: "پرانی تاریخ" },
  at_is_reversal: {
    en: "This is itself a reversal — there is no reversal of a reversal.",
    rm: "Ye khud ek reversal hai -- reversal ka reversal nahi hota.",
    ur: "یہ خود ایک ریورسل ہے — ریورسل کا ریورسل نہیں ہوتا۔",
  },

  // ---- Cheezon ki ijazatein ----
  pp_staff_select: { en: "Select Staff", rm: "Banda chunein", ur: "بندہ چنیں" },
  pp_no_staff: { en: "No staff found.", rm: "Koi banda nahi mila.", ur: "کوئی بندہ نہیں ملا۔" },
  pp_saved: { en: "Permissions saved.", rm: "Ijazatein mehfooz ho gayin.", ur: "اجازتیں محفوظ ہو گئیں۔" },
  pp_view: { en: "View", rm: "Dekhna", ur: "دیکھنا" },
  pp_view_note: { en: "Can only view products", rm: "Sirf cheezein dekh sake", ur: "صرف چیزیں دیکھ سکے" },
  pp_add: { en: "Add", rm: "Shamil karna", ur: "شامل کرنا" },
  pp_add_note: {
    en: "Can propose a new product — it goes live only after approval",
    rm: "Nayi cheez tajweez kar sake -- manzoori ke baad hi live hogi",
    ur: "نئی چیز تجویز کر سکے — منظوری کے بعد ہی لائیو ہوگی",
  },
  pp_edit: { en: "Edit", rm: "Tabdeeli", ur: "تبدیلی" },
  pp_edit_note: {
    en: "Can propose a change to an existing product — it goes live only after approval",
    rm: "Maujooda cheez mein tabdeeli tajweez kar sake -- manzoori ke baad hi live hogi",
    ur: "موجودہ چیز میں تبدیلی تجویز کر سکے — منظوری کے بعد ہی لائیو ہوگی",
  },
  pp_delete: { en: "Delete", rm: "Mitana", ur: "مٹانا" },
  pp_delete_note: {
    en: "Never give this to any staff member — deleting a product is always the admin's or owner's own job",
    rm: "Ye kabhi kisi bande ko na dein -- cheez mitana hamesha sirf Admin ya Owner khud karta hai",
    ur: "یہ کبھی کسی بندے کو نہ دیں — چیز مٹانا ہمیشہ صرف ایڈمن یا مالک خود کرتا ہے",
  },
  pp_can_approve: { en: "Can Approve", rm: "Manzoori de sake", ur: "منظوری دے سکے" },
  pp_can_approve_note: {
    en: "This person can verify others' add/edit proposals (approve, reject, ask for changes) — just as the admin does",
    rm: "Ye banda doosron ki tajweezein dekh kar faisla kar sakega (manzoor, rad, ya tabdeeli maange) -- jaise admin karta hai",
    ur: "یہ بندہ دوسروں کی تجویزیں دیکھ کر فیصلہ کر سکے گا (منظور، رد، یا تبدیلی مانگے) — جیسے ایڈمن کرتا ہے",
  },

  // ---- Gallery ----
  gl_add_item: { en: "Add Gallery Item", rm: "Gallery mein cheez shamil karein", ur: "گیلری میں چیز شامل کریں" },
  gl_caption: { en: "Caption", rm: "Neeche ki likhai", ur: "نیچے کی لکھائی" },
  gl_file_url: { en: "File URL *", rm: "File ka pata *", ur: "فائل کا پتہ *" },
  gl_upload_first: {
    en: "Upload the file to the Media Library first, then paste its URL here.",
    rm: "File pehle Media Library mein lagayein, phir us ka pata yahan chipkayein.",
    ur: "فائل پہلے میڈیا لائبریری میں لگائیں، پھر اس کا پتہ یہاں چپکائیں۔",
  },
  gl_video: { en: "Video", rm: "Video", ur: "ویڈیو" },
  gl_events: { en: "Events", rm: "Taqreebat", ur: "تقریبات" },

  // ---- FAQ ----
  fq_new: { en: "New FAQ", rm: "Naya sawal jawab", ur: "نیا سوال جواب" },
  fq_question: { en: "Question *", rm: "Sawal *", ur: "سوال *" },
  fq_answer: { en: "Answer *", rm: "Jawab *", ur: "جواب *" },
  fq_cat_account: { en: "Account & Registration", rm: "Khata aur registration", ur: "کھاتہ اور رجسٹریشن" },
  fq_cat_ordering: { en: "Ordering & Delivery", rm: "Order aur pahunchana", ur: "آرڈر اور پہنچانا" },
  fq_cat_payments: { en: "Payments & Khata", rm: "Adaigi aur khata", ur: "ادائیگی اور کھاتہ" },
  fq_cat_dealer: { en: "Becoming a Dealer", rm: "Dealer kaise banein", ur: "ڈیلر کیسے بنیں" },
  fq_cat_investor: { en: "Becoming an Investor", rm: "Sarmaya kaar kaise banein", ur: "سرمایہ کار کیسے بنیں" },
  fq_cat_crop_doctor: { en: "AI Crop Doctor", rm: "AI Crop Doctor", ur: "AI کراپ ڈاکٹر" },

  // ---- AI ke mashware ----
  as_none: { en: "No AI suggestions yet.", rm: "Abhi koi AI mashwara nahi.", ur: "ابھی کوئی AI مشورہ نہیں۔" },
  as_suggested_qty: { en: "Suggested Qty:", rm: "Tajweez shuda tadaad:", ur: "تجویز شدہ تعداد:" },
  as_approve: { en: "Approve", rm: "Manzoor karein", ur: "منظور کریں" },
  as_reject_suggestion: { en: "Reject Suggestion", rm: "Mashwara rad karein", ur: "مشورہ رد کریں" },
  as_add_comment: { en: "Add Comment", rm: "Baat likhein", ur: "بات لکھیں" },
  as_write_comment: { en: "Write your comment", rm: "Apni baat likhein", ur: "اپنی بات لکھیں" },
  as_tell_if_needed: {
    en: "Say whether this suggestion is genuinely needed or not.",
    rm: "Batayein ke ye mashwara waqai zaroori hai ya nahi.",
    ur: "بتائیں کہ یہ مشورہ واقعی ضروری ہے یا نہیں۔",
  },
  as_reason_remembered: {
    en: "The AI remembers this reason, to give better suggestions next time.",
    rm: "Ye wajah AI ko yaad rahegi, aage behtar mashwara dene ke liye.",
    ur: "یہ وجہ AI کو یاد رہے گی، آگے بہتر مشورہ دینے کے لیے۔",
  },
} as const;
