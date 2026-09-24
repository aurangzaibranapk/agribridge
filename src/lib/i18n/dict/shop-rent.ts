/**
 * Dukan ka kiraya -- agreement, mahane ki adaigi, aur utility bill.
 *
 * Istilahat glossary.ts se. Sanjhe alfaz (Cash, Notes, Amount, Band
 * Karein waghera) yahan DOBARA nahi likhe -- wo common.ts mein hain aur
 * wahin se aate hain. Dohra likhne ka anjaam ye hota ke kisi din ek
 * jagah "naqad" theek hota aur doosri jagah kuch aur.
 *
 * "Landlord" aur "Gawah" jaan boojh kar wohi lafz rakhe gaye jo kaghaz
 * par likhe jate hain -- agreement adalat mein bhi ja sakta hai, aur
 * wahan wohi zaban chalti hai jo dastawez par hai.
 */
export const shopRentDict = {
  sr_this_month: { en: "This Month", rm: "Is mahine", ur: "اس مہینے" },
  sr_advance_balance: { en: "Advance Balance", rm: "Advance baqi", ur: "ایڈوانس باقی" },
  sr_bills_unpaid: { en: "Bills (Unpaid)", rm: "Bill (jo diye nahi)", ur: "بل (جو دیے نہیں)" },
  sr_bills: { en: "Bills", rm: "Bill", ur: "بل" },
  sr_mark_paid: { en: "Mark Paid", rm: "Diya hua likhein", ur: "دیا ہوا لکھیں" },
  sr_amount_due: { en: "Amount Due", rm: "Dena hai", ur: "دینا ہے" },
  sr_amount_paid: { en: "Amount Paid", rm: "Diya", ur: "دیا" },
  sr_save_payment: { en: "Save Payment", rm: "Adaigi mehfooz karein", ur: "ادائیگی محفوظ کریں" },

  // ---- Company ki mohar ----
  sr_company_stamp: { en: "Company Stamp / Seal", rm: "Company ki mohar", ur: "کمپنی کی مہر" },
  sr_stamp_note: {
    en: "This stamp is applied to every agreement automatically.",
    rm: "Ye mohar har agreement par khud lag jayegi.",
    ur: "یہ مہر ہر ایگریمنٹ پر خود لگ جائے گی۔",
  },
  sr_stamp_saved: { en: "Stamp saved.", rm: "Mohar mehfooz ho gayi.", ur: "مہر محفوظ ہو گئی۔" },
  sr_upload_stamp: { en: "Upload Stamp", rm: "Mohar lagayein", ur: "مہر لگائیں" },

  // ---- Naya agreement ----
  sr_new_agreement: { en: "New Rent Agreement", rm: "Naya kiraya agreement", ur: "نیا کرایہ ایگریمنٹ" },
  sr_agreement_made: {
    en: "Agreement created. Go to the Digital Agreement page to sign it and send the link to the landlord.",
    rm: "Agreement ban gaya. Digital Agreement wale safhe par ja kar sign karein aur landlord ko link bhejein.",
    ur: "ایگریمنٹ بن گیا۔ ڈیجیٹل ایگریمنٹ والے صفحے پر جا کر سائن کریں اور لینڈ لارڈ کو لنک بھیجیں۔",
  },
  sr_select_shop: { en: "- Select Shop / Branch -", rm: "- Dukan / shakh chunein -", ur: "- دکان / شاخ چنیں -" },
  sr_shop_address: { en: "Shop Full Address", rm: "Dukan ka poora pata", ur: "دکان کا پورا پتہ" },
  sr_shop_size: { en: "Shop Size (e.g. 500 sq ft)", rm: "Dukan ka size (misal: 500 sq ft)", ur: "دکان کا سائز (مثال: 500 sq ft)" },

  sr_landlord: { en: "Landlord", rm: "Landlord", ur: "لینڈ لارڈ" },
  sr_landlord_name: { en: "Landlord Name", rm: "Landlord ka naam", ur: "لینڈ لارڈ کا نام" },
  sr_landlord_contact: { en: "Landlord Contact", rm: "Landlord ka raabta", ur: "لینڈ لارڈ کا رابطہ" },
  sr_landlord_cnic: { en: "Landlord CNIC", rm: "Landlord ka CNIC", ur: "لینڈ لارڈ کا CNIC" },

  sr_rent_duration: { en: "Rent & Duration", rm: "Kiraya aur muddat", ur: "کرایہ اور مدت" },
  sr_monthly_rent: { en: "Monthly Rent (Rs)", rm: "Mahana kiraya (Rs)", ur: "ماہانہ کرایہ (روپے)" },
  sr_due_day: { en: "Due Day (1-31)", rm: "Kis tareekh ko dena hai (1-31)", ur: "کس تاریخ کو دینا ہے (1-31)" },
  sr_annual_increase: { en: "Annual Increase %", rm: "Har saal izafa %", ur: "ہر سال اضافہ %" },
  sr_security_deposit: { en: "Security Deposit (Rs)", rm: "Security (Rs)", ur: "سیکیورٹی (روپے)" },
  sr_duration_years: { en: "Duration (Years)", rm: "Muddat (saal)", ur: "مدت (سال)" },
  sr_renewal_years: { en: "Renewal (Years)", rm: "Tajdeed (saal)", ur: "تجدید (سال)" },
  sr_start_date: { en: "Agreement Start Date", rm: "Agreement shuru hone ki tareekh", ur: "ایگریمنٹ شروع ہونے کی تاریخ" },
  sr_approved_use: {
    en: "Approved Use (e.g. Office, Warehouse, Retail Outlet)",
    rm: "Kis kaam ke liye (misal: daftar, godam, dukan)",
    ur: "کس کام کے لیے (مثال: دفتر، گودام، دکان)",
  },

  sr_payment_bank_details: { en: "Payment Bank Details", rm: "Adaigi ke bank ki tafseel", ur: "ادائیگی کے بینک کی تفصیل" },
  sr_company_rep: { en: "Company Representative", rm: "Company ka numainda", ur: "کمپنی کا نمائندہ" },
  sr_rep_name: { en: "Representative Name", rm: "Numainde ka naam", ur: "نمائندے کا نام" },
  sr_rep_designation: { en: "Representative Designation", rm: "Numainde ka ohda", ur: "نمائندے کا عہدہ" },

  sr_witnesses: { en: "Witnesses (optional)", rm: "Gawah (marzi se)", ur: "گواہ (مرضی سے)" },
  sr_witness1_name: { en: "Witness 1 Name", rm: "Gawah 1 ka naam", ur: "گواہ 1 کا نام" },
  sr_witness1_cnic: { en: "Witness 1 CNIC", rm: "Gawah 1 ka CNIC", ur: "گواہ 1 کا CNIC" },
  sr_witness2_name: { en: "Witness 2 Name", rm: "Gawah 2 ka naam", ur: "گواہ 2 کا نام" },
  sr_witness2_cnic: { en: "Witness 2 CNIC", rm: "Gawah 2 ka CNIC", ur: "گواہ 2 کا CNIC" },
  sr_create_agreement: { en: "Create Agreement", rm: "Agreement banayein", ur: "ایگریمنٹ بنائیں" },

  // ---- Utility bill ----
  sr_add_bill: { en: "Add Shop Bill", rm: "Dukan ka bill shamil karein", ur: "دکان کا بل شامل کریں" },
  sr_bill_added: { en: "Bill added.", rm: "Bill shamil ho gaya.", ur: "بل شامل ہو گیا۔" },
  sr_gas: { en: "Gas", rm: "Gas", ur: "گیس" },
  sr_water: { en: "Water", rm: "Paani", ur: "پانی" },
  sr_maintenance: { en: "Maintenance", rm: "Marammat", ur: "مرمت" },
  sr_internet: { en: "Internet", rm: "Internet", ur: "انٹرنیٹ" },
  sr_bill_photo: { en: "Bill Photo (optional)", rm: "Bill ki tasveer (marzi se)", ur: "بل کی تصویر (مرضی سے)" },
  sr_save_bill: { en: "Save Bill", rm: "Bill mehfooz karein", ur: "بل محفوظ کریں" },
} as const;
