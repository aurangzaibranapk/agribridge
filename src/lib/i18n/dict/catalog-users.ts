/**
 * Cheezein (products), CRM, aur Users & Roles.
 *
 * "PENDING" YAHAN TEEN ALAG CHEEZEIN HAIN, aur teenon ka agla kaam alag:
 *
 *   "Pending Products"      -- nayi cheez tajweez hui hai, admin ko
 *                              dekhni hai.
 *   "Pending Product Edits" -- maujooda cheez mein tabdeeli tajweez hui
 *                              hai, admin ko manzoor karni hai.
 *   "Pending Verify"        -- ginti: kitni cheezein intezar mein hain.
 *
 * Teenon ko "intezar mein" likh dena kaam ki nishandahi khatam kar deta
 * hai. Naya banana aur purani cheez badalna do alag faisle hain -- aur
 * doosre mein qeemat badal sakti hai, jo poore stock ki qeemat hila
 * deta hai.
 *
 * USERS KE SAFHE PAR "AUR DEPARTMENT" ka khana migration 193 se aaya --
 * ek bande ke ek se ziyada department. Us ka naam saada rakha gaya hai
 * kyunke wo qatar mein ek chhote khane mein aata hai.
 */
export const catalogUsersDict = {
  // ---- CRM ----
  cr_title: { en: "CRM", rm: "CRM", ur: "CRM" },
  cr_khata_balance: { en: "Khata Balance", rm: "Khate ka baqi", ur: "کھاتے کا باقی" },
  cr_no_customers: { en: "No customers yet.", rm: "Abhi koi gahak nahi.", ur: "ابھی کوئی گاہک نہیں۔" },
  cr_no_suppliers: { en: "No suppliers yet.", rm: "Abhi koi supplier nahi.", ur: "ابھی کوئی سپلائر نہیں۔" },
  cr_no_companies: { en: "No companies yet.", rm: "Abhi koi company nahi.", ur: "ابھی کوئی کمپنی نہیں۔" },
  cr_delete_customer_q: { en: "Delete customer?", rm: "Gahak ko mita dein?", ur: "گاہک کو مٹا دیں؟" },
  cr_payment_due_days: { en: "Payment Due (days)", rm: "Adaigi kitne din mein", ur: "ادائیگی کتنے دن میں" },
  cr_credit_limit_dot: { en: "Credit Limit (Rs.)", rm: "Udhaar ki hadd (Rs.)", ur: "ادھار کی حد (روپے)" },

  // ---- Cheezein ----
  pd_edit_product: { en: "Edit Product", rm: "Cheez tabdeel karein", ur: "چیز تبدیل کریں" },
  pd_management: { en: "Product Management", rm: "Cheezon ka intezam", ur: "چیزوں کا انتظام" },
  pd_search: { en: "Search products...", rm: "Cheezein dhoondein...", ur: "چیزیں تلاش کریں..." },
  pd_pending_verify: { en: "Pending Verify", rm: "Tasdeeq baqi", ur: "تصدیق باقی" },
  pd_pending_products: { en: "Pending Products", rm: "Nayi tajweez shuda cheezein", ur: "نئی تجویز شدہ چیزیں" },
  pd_pending_edits: { en: "Pending Product Edits", rm: "Cheezon mein tajweez shuda tabdeeli", ur: "چیزوں میں تجویز شدہ تبدیلی" },
  pd_proposed_changes: { en: "Proposed Changes", rm: "Tajweez shuda tabdeeli", ur: "تجویز شدہ تبدیلی" },
  pd_all_verified: { en: "All products are verified.", rm: "Sab cheezein tasdeeq ho chukin.", ur: "سب چیزیں تصدیق ہو چکیں۔" },
  pd_final_rate: { en: "Final Rate (Rs):", rm: "Aakhri rate (Rs):", ur: "آخری ریٹ (روپے):" },
  pd_propose_new: { en: "Propose a New Product", rm: "Nayi cheez tajweez karein", ur: "نئی چیز تجویز کریں" },
  pd_proposed_ok: {
    en: "Product proposed — it goes live after an admin verifies it.",
    rm: "Cheez tajweez ho gayi -- admin tasdeeq karega to live hogi.",
    ur: "چیز تجویز ہو گئی — ایڈمن تصدیق کرے گا تو لائیو ہوگی۔",
  },
  pd_pack_size_eg2: { en: "e.g. 1kg, 500g", rm: "misal: 1kg, 500g", ur: "مثال: 1kg، 500g" },
  pd_image: { en: "Product Image", rm: "Cheez ki tasveer", ur: "چیز کی تصویر" },
  pd_remove_image: { en: "Remove image", rm: "Tasveer hatayein", ur: "تصویر ہٹائیں" },
  pd_catalog_export: { en: "Product Catalog Export", rm: "Cheezon ki fehrist nikaalein", ur: "چیزوں کی فہرست نکالیں" },
  cx_all_categories: { en: "All Categories", rm: "Sab qismein", ur: "سب قسمیں" },
  pd_search_short: { en: "Search product", rm: "Cheez dhoondein", ur: "چیز تلاش کریں" },
  pd_select_fields: { en: "Select Fields", rm: "Kaun se khane chahiye", ur: "کون سے خانے چاہیے" },

  // ---- Users & Roles ----
  us_title: { en: "Users & Roles", rm: "Log aur un ke darje", ur: "لوگ اور ان کے درجے" },
  us_extra_departments: { en: "Other departments", rm: "Aur department", ur: "اور شعبے" },
  us_all_branches: { en: "All Branches (Admin)", rm: "Sab shakhein (Admin)", ur: "سب شاخیں (ایڈمن)" },
  us_pick_branch_first: { en: "Select a branch first", rm: "Pehle shakh chunein", ur: "پہلے شاخ چنیں" },
  us_all_shops_branch: { en: "All Shops (branch level)", rm: "Sab dukanein (shakh ke darje par)", ur: "سب دکانیں (شاخ کے درجے پر)" },
  us_organisation: { en: "Organisation", rm: "Idara", ur: "ادارہ" },
  us_reason_eg: { en: "e.g. performance issue, resignation", rm: "misal: kaarkardagi ka masla, istifa", ur: "مثال: کارکردگی کا مسئلہ، استعفیٰ" },
} as const;
