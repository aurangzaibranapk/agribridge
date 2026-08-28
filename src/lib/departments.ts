/**
 * Department ki tareef -- ek hi jagah.
 *
 * Yahan teen cheezein saath rakhi gayi hain, jaan boojh kar:
 *   kaun sa role is department mein hai,
 *   us ka apna dashboard kaun sa hai,
 *   aur shuru mein kaun se safhe khulne chahiyen.
 *
 * Teenon alag jagah rakhte to ek din naya safha banta aur kisi ek
 * fehrist mein rehta jata -- department ki ijazat mein aa jata magar
 * dashboard mein nahi, ya us ka ulta. Aisi ghaltiyan chup rehti hain:
 * kisi ko koi cheez nazar nahi aati, aur wo bata bhi nahi pata ke kya
 * nahi dikh raha.
 *
 * Yahan ki fehrist sirf SHURUATI tajweez hai. Asal ijazat database mein
 * rehti hai (role_page_permissions), jise admin /admin/departments par
 * badal sakta hai.
 */

export interface Department {
  key: string;
  label: string;
  /** Kaun sa role is department mein aata hai. */
  role: string;
  /** Us department ka apna dashboard. */
  dashboard: string;
  /** Ek jumle mein: ye department karta kya hai. */
  summary: string;
  /** Shuruati tajweez -- pehli dafa "Tajweez lagayein" par yahi bharte hain. */
  suggestedPages: string[];
}

const REPORTS_BASIC = ["/admin/reports"];
const ALWAYS = ["/admin/my-attendance", "/admin/notifications", "/admin/messages", "/admin/my-wallet"];

export const DEPARTMENTS: Department[] = [
  {
    key: "sales",
    label: "Sales",
    role: "sales_staff",
    dashboard: "/admin/dept/sales",
    summary: "Dukan ki bikri, order aur customer ka khata.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/pos",
      "/admin/agri-orders",
      "/admin/bridge-orders",
      "/admin/dealer-orders",
      "/admin/produce-orders",
      "/admin/agri-returns",
      "/admin/khata",
      "/admin/buyers",
      "/admin/dealers",
      "/admin/farmers",
      "/admin/products",
      "/admin/inventory",
      "/admin/reports/sales",
      ...REPORTS_BASIC,
    ],
  },
  {
    key: "finance",
    label: "Finance",
    role: "finance",
    dashboard: "/admin/dept/finance",
    summary: "Paisa aana jana, bill, khata aur nafa nuqsan.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/finance",
      "/admin/finance/queue",
      "/admin/finance/banks",
      "/admin/finance/payment-mapping",
      "/admin/company-expenses",
      "/admin/submissions",
      "/admin/khata",
      "/admin/staff-khata",
      "/admin/branch-credit",
      "/admin/credit-requests",
      "/admin/farmer-credit",
      "/admin/farmer-loans",
      "/admin/wallets",
      "/admin/payouts",
      "/admin/agri-orders",
      "/admin/master-dashboard",
      "/admin/reports/pnl",
      "/admin/reports/finance",
      "/admin/reports/credit",
      ...REPORTS_BASIC,
    ],
  },
  {
    key: "warehouse",
    label: "Godown / Inventory",
    role: "warehouse",
    dashboard: "/admin/dept/warehouse",
    summary: "Maal ka aana jana, stock, dispatch aur returns.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/inventory",
      "/admin/inventory/warehouses",
      "/admin/stock-transfers",
      "/admin/stock-ledger",
      "/admin/agri-orders",
      "/admin/agri-returns",
      "/admin/products",
      "/admin/products/propose",
      "/admin/categories",
      "/admin/brands",
      "/admin/companies",
      "/admin/reports/inventory",
      ...REPORTS_BASIC,
    ],
  },
  {
    key: "procurement",
    label: "Khareed / Procurement",
    role: "procurement",
    dashboard: "/admin/dept/procurement",
    summary: "Supplier se khareed, grain procurement aur adaigi.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/purchases",
      "/admin/suppliers",
      "/admin/suppliers/all-statement",
      "/admin/grain-procurement",
      "/admin/grain-procurement/dashboard",
      "/admin/grain-procurement/sell",
      "/admin/ai-suggestions",
      "/admin/agri-orders",
      "/admin/inventory",
      "/admin/reports/purchases",
      "/admin/reports/procurement",
      ...REPORTS_BASIC,
    ],
  },
  {
    key: "dairy",
    label: "Dairy / Doodh",
    role: "milk_collection",
    dashboard: "/admin/dept/dairy",
    summary: "Doodh jama karna, chiller, FAT aur route ka hisaab.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/milk-collection/collect",
      "/admin/milk-collection/walk-in",
      "/admin/milk-collection/chiller",
      "/admin/milk-collection",
      "/admin/milk-collection/routes",
      "/admin/milk-collection/fuel",
      "/admin/milk-collection/generator",
      "/admin/milk-collection/maintenance",
      "/admin/farmers",
      "/admin/reports/milk",
      ...REPORTS_BASIC,
    ],
  },
  {
    key: "machinery",
    label: "Machinery",
    role: "machinery",
    dashboard: "/admin/dept/machinery",
    summary: "Machinery kiraya, booking aur marammat.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/machinery-rental",
      "/admin/machinery-rental/dashboard",
      "/admin/machinery-rental/list",
      "/admin/drivers",
      "/admin/vehicles",
      "/admin/farmers",
      ...REPORTS_BASIC,
    ],
  },
  {
    key: "hr",
    label: "HR",
    role: "hr",
    dashboard: "/admin/dept/hr",
    summary: "Staff, hazri, tankhwah aur bharti.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/hr",
      "/admin/hr-dashboard",
      "/admin/hr/whatsapp",
      "/admin/hr/attendance-log",
      "/admin/staff-khata",
      "/admin/job-vacancies",
      "/admin/job-applications",
      "/admin/users",
      ...REPORTS_BASIC,
    ],
  },
  {
    key: "admin_office",
    label: "Admin Office",
    role: "admin_assistant",
    dashboard: "/admin/dept/admin_office",
    summary: "Daftar ka kaam, website ka maal-o-mawaad aur paighaam.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/dashboard",
      "/admin/contact-messages",
      "/admin/investor-inquiries",
      "/admin/blog",
      "/admin/gallery",
      "/admin/media-library",
      "/admin/faqs",
      "/admin/testimonials",
      "/admin/hero-slides",
      "/admin/static-pages",
      "/admin/email-templates",
      ...REPORTS_BASIC,
    ],
  },
  {
    key: "manager",
    label: "Manager",
    role: "manager",
    dashboard: "/admin/dept/manager",
    summary: "Apni branch ka sab kaam — approval, nigrani aur hisaab.",
    suggestedPages: [
      ...ALWAYS,
      "/admin/field-watch",
      "/admin/submissions",
      "/admin/agri-orders",
      "/admin/agri-returns",
      "/admin/vehicles",
      "/admin/milk-collection/verify",
      "/admin/milk-collection/chiller",
      "/admin/pos",
      "/admin/inventory",
      "/admin/stock-transfers",
      "/admin/khata",
      "/admin/branch-credit",
      "/admin/company-expenses",
      "/admin/hr/attendance-log",
      "/admin/farmers",
      "/admin/buyers",
      "/admin/dealers",
      ...REPORTS_BASIC,
      "/admin/reports/sales",
      "/admin/reports/inventory",
    ],
  },
];

/** Wo role jinhein har cheez ki ijazat hai -- in par department ki rok nahi lagti. */
export const UNRESTRICTED_ROLES = ["owner", "super_admin", "admin"];

export function departmentForRole(role: string): Department | null {
  return DEPARTMENTS.find((d) => d.role === role) ?? null;
}

export function departmentByKey(key: string): Department | null {
  return DEPARTMENTS.find((d) => d.key === key) ?? null;
}

/**
 * Login ke baad kaunsa safha khule.
 *
 * Har shakhs ko us ka apna dashboard mile -- warehouse wale ko website
 * ka dashboard dikhana us ke waqt ka nuqsan hai aur us se ye tass'ur
 * banta hai ke system us ka kaam samajhta hi nahi.
 */
export function homePageForRole(role: string): string {
  if (UNRESTRICTED_ROLES.includes(role)) return "/admin/master-dashboard";
  return departmentForRole(role)?.dashboard ?? "/admin/dashboard";
}
