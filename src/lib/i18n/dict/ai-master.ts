/**
 * Bridge AI, Master Dashboard, naukri ki darkhwastein, aur doodh ke
 * baqi safhe.
 *
 * MASTER DASHBOARD PAR "AANA HAI" AUR "DENA HAI" do alag khane hain,
 * aur donon ka jama karke ek adad dikhana sab se bara jhoot hota. Jo
 * paisa aana hai wo abhi hamare paas NAHI hai; jo dena hai wo hamara
 * hai hi nahi. Ek "net" adad dikhane wala safha malik ko har roz ghalat
 * andaza deta.
 *
 * "BINA DATA KE JAWAB" (Bridge AI ka khana) jaan boojh kar alag ginaa
 * jata hai. Ye wo sawal hain jin par AI ne kuch kaha magar us ke peechhe
 * koi record nahi tha. Un ki ginti alag rakhna hi wo cheez hai jo bata
 * sakti hai ke AI par kitna bharosa kiya ja sakta hai.
 *
 * "FI LITRE CHALANE KA KHARCHA" ke saath likha hai "doodh ke daam ke
 * ilawa". Ye qaid zaroori hai: bina us ke banda samajhta hai ke poora
 * kharcha yahi hai, jabke kisan ko diya hua paisa alag hai aur wo sab
 * se bara khana hai.
 */
export const aiMasterDict = {
  // ---- Bridge AI ----
  ba_title: { en: "Bridge AI", rm: "Bridge AI", ur: "برج AI" },
  ba_action_requests: { en: "Bridge AI — Action Requests", rm: "Bridge AI -- kaam ki darkhwastein", ur: "برج AI — کام کی درخواستیں" },
  ba_loading: { en: "Loading...", rm: "Aa raha hai...", ur: "آ رہا ہے..." },
  ba_no_pending: { en: "No pending requests.", rm: "Koi darkhwast intezar mein nahi.", ur: "کوئی درخواست انتظار میں نہیں۔" },
  ba_select: { en: "Select", rm: "Chunein", ur: "چنیں" },
  ba_unit_cost: { en: "Unit Cost (Rs.)", rm: "Fi unit lagat (Rs.)", ur: "فی یونٹ لاگت (روپے)" },
  ba_note_optional: {
    en: "Optional note (e.g. the reason for rejecting or changing)",
    rm: "Note (marzi se) -- jaise rad karne ya badalne ki wajah",
    ur: "نوٹ (مرضی سے) — جیسے رد کرنے یا بدلنے کی وجہ",
  },
  ba_no_decision_yet: { en: "No decision has been made yet.", rm: "Abhi tak koi faisla nahi hua.", ur: "ابھی تک کوئی فیصلہ نہیں ہوا۔" },
  ba_activity_log: { en: "Bridge AI Activity Log", rm: "Bridge AI ka indraj", ur: "برج AI کا اندراج" },
  ba_total_questions: { en: "Total Questions", rm: "Kul sawal", ur: "کل سوال" },
  ba_today_questions: { en: "Today's Questions", rm: "Aaj ke sawal", ur: "آج کے سوال" },
  ba_answers_without_data: { en: "Answers without data", rm: "Bina record ke jawab", ur: "بغیر ریکارڈ کے جواب" },
  ba_top_tool: { en: "Most-used Tool", rm: "Sab se ziyada chalne wala tool", ur: "سب سے زیادہ چلنے والا ٹول" },
  ba_by_agent: { en: "Questions by Agent", rm: "Kis agent ke kitne sawal", ur: "کس ایجنٹ کے کتنے سوال" },
  ba_top_tools: { en: "Most-used Tools", rm: "Sab se ziyada chalne wale tools", ur: "سب سے زیادہ چلنے والے ٹولز" },
  ba_no_activity: { en: "No activity yet.", rm: "Abhi tak koi kaam nahi hua.", ur: "ابھی تک کوئی کام نہیں ہوا۔" },
  ba_ask_anything: { en: "Ask anything — for example:", rm: "Kuch bhi poochhein -- jaise:", ur: "کچھ بھی پوچھیں — جیسے:" },
  ba_thinking: { en: "Bridge AI is thinking...", rm: "Bridge AI soch raha hai...", ur: "برج AI سوچ رہا ہے..." },
  ba_write_question: { en: "Write your question...", rm: "Apna sawal likhein...", ur: "اپنا سوال لکھیں..." },

  // ---- Naukri ki darkhwastein ----
  ja_title: { en: "Job Applications", rm: "Naukri ki darkhwastein", ur: "نوکری کی درخواستیں" },
  ja_none_yet: { en: "No applications yet", rm: "Abhi koi darkhwast nahi", ur: "ابھی کوئی درخواست نہیں" },
  ja_vacancy: { en: "Vacancy", rm: "Kaunsi jagah", ur: "کون سی جگہ" },
  ja_id_card: { en: "ID Card", rm: "ID card", ur: "ID کارڈ" },
  ja_send_offer: { en: "Send Job Offer", rm: "Naukri ki peshkash bhejein", ur: "نوکری کی پیشکش بھیجیں" },
  ja_offer_sent: { en: "Offer sent.", rm: "Peshkash bhej di gayi.", ur: "پیشکش بھیج دی گئی۔" },
  ja_offer_resent: { en: "Offer sent again.", rm: "Peshkash dobara bhej di gayi.", ur: "پیشکش دوبارہ بھیج دی گئی۔" },
  ja_proposed_salary: { en: "Proposed Salary (Rs.)", rm: "Tajweez shuda tankhwah (Rs.)", ur: "تجویز شدہ تنخواہ (روپے)" },
  ja_message_optional: { en: "Message (optional)", rm: "Paighaam (marzi se)", ur: "پیغام (مرضی سے)" },

  // ---- Master Dashboard ----
  md_title: { en: "Master Dashboard", rm: "Master Dashboard", ur: "ماسٹر ڈیش بورڈ" },
  md_company_expenses: { en: "Company Expenses (non-milk)", rm: "Company ke kharche (doodh ke ilawa)", ur: "کمپنی کے خرچے (دودھ کے علاوہ)" },
  md_milk_costs: { en: "Milk Collection Costs", rm: "Doodh jama karne ke kharche", ur: "دودھ جمع کرنے کے خرچے" },
  md_total_capital: { en: "Total Invested (capital)", rm: "Kul lagaya hua sarmaya", ur: "کل لگایا ہوا سرمایہ" },
  md_bank_cash: { en: "Bank / Cash Balance", rm: "Bank aur naqad ka baqi", ur: "بینک اور نقد کا باقی" },
  md_inventory_value: { en: "Inventory Value", rm: "Stock ki qeemat", ur: "اسٹاک کی قیمت" },
  md_receivables: { en: "To Receive", rm: "Aana hai", ur: "آنا ہے" },
  md_payables: { en: "To Pay", rm: "Dena hai", ur: "دینا ہے" },
  md_no_detail: { en: "No detail.", rm: "Koi tafseel nahi.", ur: "کوئی تفصیل نہیں۔" },
  md_add_capital: { en: "Add Capital / Investment", rm: "Sarmaya shamil karein", ur: "سرمایہ شامل کریں" },
  md_owner_capital: { en: "Owner's own capital", rm: "Malik ka apna sarmaya", ur: "مالک کا اپنا سرمایہ" },
  md_bank_loan: { en: "Bank loan", rm: "Bank ka qarza", ur: "بینک کا قرضہ" },
  md_borrowed: { en: "Borrowed from someone", rm: "Kisi se udhaar liya", ur: "کسی سے ادھار لیا" },
  md_reinvested: { en: "Profit put back in", rm: "Munafa wapas laga diya", ur: "منافع واپس لگا دیا" },
  md_document_optional: { en: "Document (loan agreement etc.) — optional", rm: "Kaghaz (qarze ka agreement waghera) -- marzi se", ur: "کاغذ (قرضے کا ایگریمنٹ وغیرہ) — مرضی سے" },
  md_total_revenue: { en: "Total Revenue", rm: "Kul aamdani", ur: "کل آمدنی" },
  md_total_expenses: { en: "Total Expenses", rm: "Kul kharche", ur: "کل خرچے" },
  md_net_pl: { en: "Net Profit / Loss", rm: "Saaf nafa ya nuqsan", ur: "صاف نفع یا نقصان" },

  // ---- Doodh ke baqi safhe ----
  mc_billing_title: { en: "Company Billing & P&L", rm: "Company ki billing aur nafa nuqsan", ur: "کمپنی کی بلنگ اور نفع نقصان" },
  mc_fuel_title: { en: "Route & Fuel Tracker", rm: "Route aur tel ka hisaab", ur: "روٹ اور تیل کا حساب" },
  mc_generator_title: { en: "Generator Diesel Tracker", rm: "Generator ke diesel ka hisaab", ur: "جنریٹر کے ڈیزل کا حساب" },
  mc_fleet_title: { en: "Fleet & Maintenance", rm: "Gaariyan aur marammat", ur: "گاڑیاں اور مرمت" },
  mc_not_for_you: { en: "This page is not for you.", rm: "Ye safha aap ke liye nahi hai.", ur: "یہ صفحہ آپ کے لیے نہیں ہے۔" },
  mc_cost_per_litre: { en: "Cost per Litre", rm: "Fi litre kharcha", ur: "فی لیٹر خرچہ" },
  mc_month: { en: "Month", rm: "Mahina", ur: "مہینہ" },
  mc_year: { en: "Year", rm: "Saal", ur: "سال" },
  mc_paid_to_farmers: { en: "Paid to farmers", rm: "Kisanon ko diya", ur: "کسانوں کو دیا" },
  mc_running_cost: { en: "Running cost", rm: "Chalane ka kharcha", ur: "چلانے کا خرچہ" },
  mc_besides_milk_price: { en: "besides the milk price", rm: "doodh ke daam ke ilawa", ur: "دودھ کے دام کے علاوہ" },
  mc_running_per_litre: { en: "Running cost per litre", rm: "Fi litre chalane ka kharcha", ur: "فی لیٹر چلانے کا خرچہ" },
  mc_expense: { en: "Expense", rm: "Kharcha", ur: "خرچہ" },
  mc_from_where: { en: "From where", rm: "Kahan se", ur: "کہاں سے" },
  mc_per_litre: { en: "Per litre", rm: "Fi litre", ur: "فی لیٹر" },
  mc_no_pending_maintenance: {
    en: "No maintenance is awaiting a decision.",
    rm: "Koi marammat faisle ke intezar mein nahi.",
    ur: "کوئی مرمت فیصلے کے انتظار میں نہیں۔",
  },
  mc_waiting_branch_manager: { en: "Waiting for the branch manager's decision.", rm: "Shakh ke manager ke faisle ka intezar hai.", ur: "شاخ کے منیجر کے فیصلے کا انتظار ہے۔" },
  mc_waiting_milk_manager: { en: "Waiting for the milk manager's final approval.", rm: "Doodh ke manager ki aakhri manzoori ka intezar hai.", ur: "دودھ کے منیجر کی آخری منظوری کا انتظار ہے۔" },
} as const;
