/**
 * Hazri, staff aur tankhwah ke alfaz.
 *
 * Istilahat glossary.ts se: staff, manager, shakh, tareekh, hazri,
 * raqam, adaigi, wajah, mehfooz karein, mansookh.
 *
 * Do lafz yahan tay ho rahe hain:
 *
 *   Attendance   Hazri       حاضری
 *   Salary       Tankhwah    تنخواہ
 *
 * Attendance ki halatein (present/absent/leave/half_day) ka tarjuma
 * kiya gaya hai kyunke ye register par roz likhi jati hain aur us bande
 * ne kabhi English mein nahi likhin. Magar "Role" ka tarjuma nahi kiya:
 * role ke naam (Sales Staff, Manager, Admin) system ke naam hain, aur
 * inhein badalne se ye samajh khatm ho jati ke kis ko kya ijazat hai.
 */
export const hrDict = {
  hr_title: { en: "HR — Staff", rm: "HR — Staff", ur: "ایچ آر — عملہ" },
  hr_subtitle: {
    en: "Staff details, attendance and salary records",
    rm: "Staff ki tafseel, hazri aur tankhwah ka record",
    ur: "عملے کی تفصیل، حاضری اور تنخواہ کا ریکارڈ",
  },

  // --- Tabs ---
  hr_tab_staff: { en: "Staff", rm: "Staff", ur: "عملہ" },
  hr_tab_attendance: { en: "Attendance", rm: "Hazri", ur: "حاضری" },
  hr_tab_salary: { en: "Salary", rm: "Tankhwah", ur: "تنخواہ" },

  // --- Staff ki fehrist ---
  hr_invite_staff: { en: "Invite New Staff", rm: "Naya Staff Invite Karein", ur: "نیا ملازم دعوت دیں" },
  hr_name: { en: "Name", rm: "Naam", ur: "نام" },
  hr_role: { en: "Role", rm: "Role", ur: "رول" },
  hr_designation: { en: "Designation", rm: "Ohda", ur: "عہدہ" },
  hr_phone: { en: "Phone", rm: "Phone", ur: "فون" },
  hr_basic_salary: { en: "Basic Salary", rm: "Bunyadi Tankhwah", ur: "بنیادی تنخواہ" },
  hr_edit: { en: "Edit", rm: "Badlein", ur: "بدلیں" },
  hr_no_staff: { en: "There is no staff.", rm: "Koi Staff nahi hai.", ur: "کوئی ملازم نہیں ہے۔" },
  hr_no_record: { en: "There is no record.", rm: "Koi record nahi hai.", ur: "کوئی ریکارڈ نہیں ہے۔" },

  // --- Ek se ziyada chunna ---
  hr_selected: { en: "selected", rm: "chune gaye", ur: "منتخب" },
  hr_confirm_deactivate: {
    en: "Do you want to make these staff members inactive?",
    rm: "Kya aap in Staff ko Inactive karna chahte hain?",
    ur: "کیا آپ ان ملازمین کو غیر فعال کرنا چاہتے ہیں؟",
  },
  hr_deactivate: { en: "Make Inactive", rm: "Inactive Karein", ur: "غیر فعال کریں" },
  hr_cancel: { en: "Cancel", rm: "Mansookh", ur: "منسوخ" },

  // --- Hazri ---
  hr_mark_attendance: { en: "Mark Attendance", rm: "Hazri Lagayein", ur: "حاضری لگائیں" },
  hr_staff: { en: "Staff", rm: "Staff", ur: "عملہ" },
  hr_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  hr_status: { en: "Status", rm: "Halat", ur: "حالت" },
  hr_present: { en: "Present", rm: "Hazir", ur: "حاضر" },
  hr_absent: { en: "Absent", rm: "Ghair hazir", ur: "غیر حاضر" },
  hr_leave: { en: "Leave", rm: "Chhutti", ur: "چھٹی" },
  hr_half_day: { en: "Half Day", rm: "Aadha din", ur: "آدھا دن" },
  hr_pick_staff: { en: "- pick a staff member -", rm: "- Staff chunein -", ur: "- ملازم منتخب کریں -" },
  hr_mark: { en: "Mark", rm: "Lagayein", ur: "لگائیں" },

  // --- Tankhwah ---
  hr_record_salary: { en: "Record Salary", rm: "Tankhwah Darj Karein", ur: "تنخواہ درج کریں" },
  hr_month_year: { en: "Month/Year", rm: "Mahina/Saal", ur: "مہینہ/سال" },
  hr_net_salary: { en: "Net Salary", rm: "Kul Tankhwah", ur: "کل تنخواہ" },
  hr_paid: { en: "Paid", rm: "Ada ho gayi", ur: "ادا ہو گئی" },
  hr_pending: { en: "Pending", rm: "Baqi hai", ur: "باقی ہے" },
  hr_month: { en: "Month", rm: "Mahina", ur: "مہینہ" },
  hr_year: { en: "Year", rm: "Saal", ur: "سال" },
  hr_basic_salary_req: { en: "Basic Salary *", rm: "Bunyadi Tankhwah *", ur: "بنیادی تنخواہ *" },
  hr_bonus: { en: "Bonus (optional)", rm: "Bonus (marzi se)", ur: "بونس (مرضی سے)" },
  hr_deductions: { en: "Deductions (optional)", rm: "Kaatein (marzi se)", ur: "کٹوتیاں (مرضی سے)" },
  hr_advance_deduction: { en: "Advance deduction (optional)", rm: "Advance ki katauti (marzi se)", ur: "ایڈوانس کی کٹوتی (مرضی سے)" },
  hr_record: { en: "Record", rm: "Darj Karein", ur: "درج کریں" },
  hr_from_which_account: { en: "From which account...", rm: "Kis khate se...", ur: "کس کھاتے سے..." },
  hr_mark_paid: { en: "Mark as Paid", rm: "Ada Shuda Lagayein", ur: "ادا شدہ لگائیں" },

  // --- Invite ---
  hr_invite_sent: {
    en: "The invite has been sent — the login details are in the email.",
    rm: "Invite bhej di gayi, login details email mein hain.",
    ur: "دعوت بھیج دی گئی، لاگ ان تفصیلات ای میل میں ہیں۔",
  },
  hr_name_req: { en: "Name *", rm: "Naam *", ur: "نام *" },
  hr_email_req: { en: "Email *", rm: "Email *", ur: "ای میل *" },
  hr_branch_optional: { en: "- Branch (optional) -", rm: "- Shakh (marzi se) -", ur: "- شاخ (مرضی سے) -" },
  hr_designation_optional: { en: "Designation (optional)", rm: "Ohda (marzi se)", ur: "عہدہ (مرضی سے)" },
  hr_basic_salary_optional: { en: "Basic salary (optional)", rm: "Bunyadi tankhwah (marzi se)", ur: "بنیادی تنخواہ (مرضی سے)" },
  hr_invite: { en: "Invite", rm: "Invite Karein", ur: "دعوت دیں" },

  // --- Staff ki tafseel ---
  hr_details: { en: "Details", rm: "Tafseel", ur: "تفصیل" },
  hr_cnic: { en: "CNIC", rm: "CNIC", ur: "شناختی کارڈ" },
  hr_address: { en: "Address", rm: "Pata", ur: "پتہ" },
  hr_hire_date: { en: "Hire Date", rm: "Kaam shuru karne ki tareekh", ur: "کام شروع کرنے کی تاریخ" },
  hr_bank_account: { en: "Bank Account", rm: "Bank Khata", ur: "بینک کھاتہ" },
  hr_save: { en: "Save", rm: "Mehfooz Karein", ur: "محفوظ کریں" },
  hr_saving: { en: "Saving...", rm: "Mehfooz ho raha hai...", ur: "محفوظ ہو رہا ہے..." },
  hr_notes_optional: { en: "Notes (optional)", rm: "Notes (marzi se)", ur: "نوٹس (مرضی سے)" },
} as const;

/**
 * Hazri ka record (location ke sath).
 *
 * "Daira" (geofence) ka lafz yahan tay ho raha hai: branch ke gird wo
 * ghera jis ke andar khare ho kar hazri lagana durust mana jata hai.
 */
export const attendanceLogDict = {
  al_title: { en: "Attendance Log (with location)", rm: "Hazri ka Record (Location ke sath)", ur: "حاضری کا ریکارڈ (لوکیشن کے ساتھ)" },
  al_subtitle: {
    en: "Who is marking attendance from where — inside the circle or outside it.",
    rm: "Kaun kahan se hazri laga raha hai — daire ke andar ya bahar.",
    ur: "کون کہاں سے حاضری لگا رہا ہے — دائرے کے اندر یا باہر۔",
  },
  al_total: { en: "Total attendances", rm: "Kul hazriyan", ur: "کل حاضریاں" },
  al_outside: { en: "Outside the circle", rm: "Daire se bahar", ur: "دائرے سے باہر" },
  al_unverified: { en: "Could not be verified", rm: "Tasdeeq nahi ho saki", ur: "تصدیق نہیں ہو سکی" },
  al_unverified_why: {
    en: "Location was not sent, or the branch's place is not recorded",
    rm: "Location nahi bheji, ya branch ki jagah darj nahi",
    ur: "لوکیشن نہیں بھیجی، یا شاخ کی جگہ درج نہیں",
  },
  al_none_yet: { en: "No attendance has been marked yet.", rm: "Abhi tak koi hazri nahi lagi.", ur: "ابھی تک کوئی حاضری نہیں لگی۔" },
  al_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  al_name: { en: "Name", rm: "Naam", ur: "نام" },
  al_in: { en: "In", rm: "Aaya", ur: "آیا" },
  al_out: { en: "Out", rm: "Gaya", ur: "گیا" },
  al_from_where: { en: "From where", rm: "Kahan se", ur: "کہاں سے" },
  al_via: { en: "Via", rm: "Zariya", ur: "ذریعہ" },
  al_at_branch: { en: "At the branch", rm: "Branch par", ur: "شاخ پر" },
  al_far_away: { en: "From far —", rm: "Door se —", ur: "دور سے —" },
  al_branch_place_missing: { en: "The branch's place is not recorded", rm: "Branch ki jagah darj nahi", ur: "شاخ کی جگہ درج نہیں" },
  al_no_location: { en: "Location was not sent", rm: "Location nahi bheji", ur: "لوکیشن نہیں بھیجی" },
  al_map: { en: "Map", rm: "Map", ur: "نقشہ" },
  al_website: { en: "Website", rm: "Website", ur: "ویب سائٹ" },
} as const;
