import {
  LayoutDashboard, FileText, Quote, Image as ImageIcon, HelpCircle,
  Smartphone, Mail, Handshake, Sliders, Menu as MenuIcon, FileCode, UserCog, History, Package, Wheat, FolderOpen, Tag, Layers, Building2, ShoppingCart, Wallet, BarChart3, Truck, ClipboardList, Boxes, Droplet, Store, ArrowLeftRight, Users, PackageSearch, LineChart, PiggyBank, Sprout, Bug, Leaf, Beef, ShoppingBasket, Landmark, Contact, Globe, ShoppingBag, HandCoins, CircleDollarSign, CreditCard, FileCheck, Calculator, Bell, List, MapPin, Briefcase, ShieldCheck, AlertTriangle, Bike, Zap, Wrench, Receipt, ClipboardCheck, PackagePlus, WalletCards, LayoutGrid, MailPlus, Home, ClipboardType, FileBarChart, ReceiptText, Scale, FileSpreadsheet, Sparkles, IdCard, Bot, SlidersHorizontal, MessageCircle, Trash2, Undo2, Inbox, ListChecks, PackageCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const DASHBOARD_ITEM: NavItem = { href: "/admin/command-center", label: "Owner Command Center", icon: Scale };

const LEGACY_ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Business",
    items: [
      { href: "/admin/farmers", label: "Farmers", icon: Wheat },
      { href: "/admin/dealers", label: "Dealers", icon: Users },
      { href: "/admin/buyers", label: "Buyers", icon: ShoppingBag },
      { href: "/admin/suppliers", label: "Suppliers", icon: Truck },
      { href: "/admin/suppliers/all-statement", label: "Sab Suppliers Statement", icon: FileBarChart },
      { href: "/admin/investors", label: "Investors", icon: PiggyBank },
      { href: "/admin/branches", label: "Branches", icon: Store },
      { href: "/admin/branches/locations", label: "Branch Locations", icon: MapPin },
      { href: "/admin/shops", label: "Shops", icon: Store },
      { href: "/admin/shop-rent", label: "Shop Rent & Bills", icon: Home },
      { href: "/admin/drivers", label: "Drivers & Vehicles", icon: IdCard },
      { href: "/admin/vehicles", label: "Gaariyan (Rozana)", icon: Bike },
      { href: "/admin/crm", label: "CRM", icon: Contact },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/pos", label: "POS", icon: ShoppingCart },
      { href: "/admin/agri-orders", label: "AgriBridge Ordering", icon: ClipboardType },
      { href: "/admin/bridge-orders", label: "Orders", icon: PackageSearch },
      { href: "/admin/produce-orders", label: "Produce Orders", icon: HandCoins },
      { href: "/admin/dealer-orders", label: "Dealer Orders", icon: ClipboardList },
    ],
  },
  {
    label: "Purchases",
    items: [
      { href: "/admin/purchases", label: "Purchases", icon: ClipboardList },
      { href: "/admin/grain-procurement/dashboard", label: "Grain Business Dashboard", icon: LineChart },
      { href: "/admin/grain-procurement", label: "Grain Procurement", icon: Wheat },
      { href: "/admin/grain-procurement/sell", label: "Grain Bechein (Sell)", icon: HandCoins },
      { href: "/admin/grain-procurement/payments", label: "Kisan ki Adaigi (Grain)", icon: Wallet },
      { href: "/admin/grain-procurement/warehouse", label: "Grain Godam", icon: Building2 },
      { href: "/admin/grain/leads", label: "Grain Leads", icon: ClipboardList },
      { href: "/admin/ai-suggestions", label: "AI Purchase Suggestions", icon: Bot },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/products/setup", label: "Product Setup", icon: ListChecks },
      { href: "/admin/products/masters", label: "Product Masters", icon: Layers },
      { href: "/admin/inventory", label: "Stock", icon: Boxes },
      { href: "/admin/stock-ledger", label: "Stock Ledger", icon: List },
      { href: "/admin/stock-transfers", label: "Stock Transfers", icon: ArrowLeftRight },
      { href: "/admin/agri-returns", label: "Stock Returns", icon: Undo2 },
      { href: "/admin/stock-count", label: "Maal ki Ginti", icon: ClipboardCheck },
      { href: "/admin/inventory/warehouses", label: "Warehouses", icon: Building2 },
      { href: "/admin/inventory/receiving", label: "Receiving", icon: PackageCheck },
    ],
  },
  {
    label: "Agriculture",
    items: [
      { href: "/admin/fertilizer", label: "Fertilizer", icon: Sprout },
      { href: "/admin/pesticide", label: "Pesticide", icon: Bug },
      { href: "/admin/seeds", label: "Seeds", icon: Leaf },
      { href: "/admin/wanda", label: "Wanda", icon: Beef },
      { href: "/admin/machinery-rental/dashboard", label: "Machinery Dashboard", icon: LineChart },
      { href: "/admin/machinery-rental", label: "Machinery Rental", icon: Wrench },
      { href: "/admin/machinery-rental/list", label: "Machinery Bookings List", icon: List },
      { href: "/admin/machinery-rental/reports", label: "Machinery Reports", icon: FileBarChart },
      { href: "/admin/grocery", label: "Grocery", icon: ShoppingBasket },
    ],
  },
  {
    label: "Dairy",
    items: [
      { href: "/admin/milk-collection/collect", label: "Doodh Jama Karein", icon: Droplet },
      { href: "/admin/milk-collection/walk-in", label: "Walk-in / Self Delivery", icon: Store },
      { href: "/admin/milk-collection/chiller", label: "Chiller — FAT", icon: Droplet },
      { href: "/admin/milk-collection/verify", label: "Milk Manager Verify", icon: ClipboardCheck },
      { href: "/admin/milk-collection", label: "Milk Collection", icon: Droplet },
      { href: "/admin/milk-collection/routes", label: "Route & Shortage", icon: AlertTriangle },
      { href: "/admin/milk-collection/fuel", label: "Fuel Tracker", icon: Bike },
      { href: "/admin/milk-collection/generator", label: "Generator Tracker", icon: Zap },
      { href: "/admin/milk-collection/maintenance", label: "Fleet & Maintenance", icon: Wrench },
      { href: "/admin/milk-collection/cost-per-liter", label: "Fi Litre Kharcha", icon: Calculator },
      { href: "/admin/milk-collection/billing", label: "Company Billing & P&L", icon: Receipt },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/money-trail", label: "Paisa Kahan Hai (Money Trail)", icon: Scale },
      { href: "/admin/shaam-ka-hisaab", label: "Shaam ka Hisaab", icon: Calculator },
      { href: "/admin/cash-close", label: "Raat ki Cash Ginti", icon: Calculator },
      { href: "/admin/cash-handover", label: "Cash Haath Badalna", icon: ArrowLeftRight },
      { href: "/admin/bank-reconcile", label: "Bank se Milaan", icon: Landmark },
      { href: "/admin/quantity-money", label: "Miqdar aur Paisa", icon: Scale },
      { href: "/admin/reconciliation", label: "Roz ka Milaan", icon: ClipboardCheck },
      { href: "/admin/leakage", label: "Paisa Kahan Se Nikal Raha Hai", icon: AlertTriangle },
      { href: "/admin/audit-trail", label: "Reversal aur Purani Tareekh", icon: History },
      { href: "/admin/anomalies", label: "Ghair-maamooli Tarteeb", icon: Bell },
      { href: "/admin/master-dashboard", label: "Master Dashboard", icon: Scale },
      { href: "/admin/reports/pnl", label: "Profit & Loss (Shop-wise)", icon: LineChart },
      { href: "/admin/finance/queue", label: "Finance Queue", icon: CreditCard },
      { href: "/admin/finance/payment-mapping", label: "Payment Method Mapping", icon: CreditCard },
      { href: "/admin/kharche", label: "Paisa & Khata", icon: ReceiptText },
      { href: "/admin/load-bill", label: "Load / Bill", icon: Smartphone },
      { href: "/admin/settlements", label: "Khaton ka Adjustment", icon: Scale },
      { href: "/admin/finance", label: "Cash Book", icon: Landmark },
      { href: "/admin/finance/banks", label: "Banks", icon: Landmark },
      { href: "/admin/khata", label: "Khata", icon: Wallet },
      { href: "/admin/staff-khata", label: "Staff Khata", icon: WalletCards },
      { href: "/admin/branch-credit", label: "Store Credit & Advance", icon: WalletCards },
      { href: "/admin/credit-requests", label: "Credit Requests", icon: FileCheck },
      { href: "/admin/farmer-credit", label: "Farmer Credit", icon: CreditCard },
      { href: "/admin/farmer-loans", label: "Farmer Loans", icon: HandCoins },
      { href: "/admin/wallets", label: "Wallets", icon: Wallet },
      { href: "/admin/my-wallet", label: "My Wallet", icon: Wallet },
      { href: "/admin/payouts", label: "Payouts", icon: CircleDollarSign },
    ],
  },
  {
    label: "Rates",
    items: [{ href: "/admin/rate-master", label: "Rate Master", icon: Calculator }],
  },
  {
    label: "Reports",
    items: [
      { href: "/admin/reports", label: "Reports Overview", icon: BarChart3 },
      { href: "/admin/reports/milk", label: "Milk Report", icon: Droplet },
      { href: "/admin/reports/sales", label: "Sales Report", icon: ShoppingCart },
      { href: "/admin/reports/purchases", label: "Purchases Report", icon: ClipboardList },
      { href: "/admin/reports/inventory", label: "Inventory Report", icon: Boxes },
      { href: "/admin/reports/finance", label: "Finance Report", icon: Landmark },
      { href: "/admin/reports/credit", label: "Credit Report", icon: CreditCard },
      { href: "/admin/reports/procurement", label: "Procurement Report", icon: Wheat },
      { href: "/admin/reports/audit", label: "Audit Center (Loss Tracking)", icon: AlertTriangle },
    ],
  },
  {
    label: "Website CMS",
    items: [
      { href: "/admin/dashboard", label: "Website Dashboard", icon: LayoutDashboard },
      { href: "/admin/hero-slides", label: "Hero Slider", icon: Sliders },
      { href: "/admin/blog", label: "Blog", icon: FileText },
      { href: "/admin/testimonials", label: "Testimonials", icon: Quote },
      { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
      { href: "/admin/media-library", label: "Media", icon: FolderOpen },
      { href: "/admin/faqs", label: "FAQ", icon: HelpCircle },
      { href: "/admin/static-pages", label: "Pages", icon: FileCode },
      { href: "/admin/menus", label: "Menus", icon: MenuIcon },
      { href: "/admin/contact-messages", label: "Contact Messages", icon: Mail },
      { href: "/admin/investor-inquiries", label: "Investor Inquiries", icon: Handshake },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/messages", label: "Messages", icon: MessageCircle },
      { href: "/admin/bridge-ai", label: "Bridge AI", icon: Sparkles },
      { href: "/admin/bridge-ai/activity-log", label: "Bridge AI Activity Log", icon: History },
      { href: "/admin/bridge-ai/action-requests", label: "Bridge AI Action Requests", icon: ClipboardCheck },
      { href: "/admin/ai-instructions", label: "AI Instructions", icon: SlidersHorizontal },
      { href: "/admin/ai-usage", label: "AI ka Khata (Usage)", icon: CircleDollarSign },
      { href: "/admin/platform", label: "Platform / Clients", icon: Globe },
      { href: "/admin/job-vacancies", label: "Job Vacancies", icon: Briefcase },
      { href: "/admin/job-applications", label: "Job Applications", icon: FileCheck },
      { href: "/admin/hr-dashboard", label: "HR Dashboard", icon: LayoutGrid },
      { href: "/admin/email-templates", label: "Email Templates", icon: MailPlus },
      { href: "/admin/hr", label: "HR - Staff", icon: UserCog },
      { href: "/admin/hr/whatsapp", label: "Staff WhatsApp", icon: MessageCircle },
      { href: "/admin/hr/attendance-log", label: "Hazri Record", icon: ClipboardCheck },
      { href: "/admin/hr/attendance/board", label: "Hazri Board", icon: AlertTriangle },
      { href: "/admin/submissions", label: "Approval Inbox", icon: Inbox },
      { href: "/admin/field-watch", label: "Maidan ki Nigrani", icon: AlertTriangle },
      { href: "/admin/dashboard-manager", label: "Dashboard & Feature Manager", icon: LayoutGrid },
      { href: "/admin/departments", label: "Department aur Ijazat", icon: ShieldCheck },
      { href: "/admin/my-department", label: "Meri Team (Head)", icon: Users },
      { href: "/admin/staff-access", label: "Ek Banday ki Ijazat", icon: ShieldCheck },
      { href: "/admin/product-permissions", label: "Product Permissions", icon: ShieldCheck },
      { href: "/admin/users", label: "Users & Roles", icon: UserCog },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/activity-logs", label: "Kis Ne Kya Kiya", icon: History },
      { href: "/admin/settings", label: "Website Settings", icon: Sliders },
      { href: "/admin/reset-test-data", label: "Reset Test Data", icon: Trash2 },
    ],
  },
];

const FINAL_DEPARTMENTS = [
  "Master Command",
  "Branches",
  "Shops",
  "Sales & POS",
  "AgriBridge Ordering",
  "Procurement",
  "Grain Business",
  "Purchases",
  "Milk & Dairy",
  "Machinery",
  "Product Management",
  "Inventory & Warehouse",
  "Fuel Management",
  "Generator Management",
  "Fleet Management",
  "Farmers",
  "Dealers",
  "Buyers",
  "Suppliers",
  "CRM",
  "Finance & Accounting",
  "HR & Staff",
  "Audit & Control",
  "Reports & Analytics",
  "Website",
  "Bridge AI",
  "Administration & Security",
] as const;

function canonicalDepartment(href: string): (typeof FINAL_DEPARTMENTS)[number] {
  if (href === "/admin/command-center" || href === "/admin/master-dashboard" || href === "/admin/investors") return "Master Command";
  if (href.startsWith("/admin/branches")) return "Branches";
  if (["/admin/shops", "/admin/shop-rent", "/admin/branch-credit"].includes(href) || href.startsWith("/admin/shop-360")) return "Shops";
  if (href.startsWith("/admin/agri-orders") || href.startsWith("/admin/pos/ordering")) return "AgriBridge Ordering";
  if (href === "/admin/grain-procurement" || href.includes("grain-procurement/payment") || href.includes("grain-procurement/statement")) return "Procurement";
  if (href.startsWith("/admin/grain")) return "Grain Business";
  if (href.startsWith("/admin/purchases") || href === "/admin/ai-suggestions") return "Purchases";
  if (href === "/admin/milk-collection/fuel") return "Fuel Management";
  if (href === "/admin/milk-collection/generator") return "Generator Management";
  if (href === "/admin/milk-collection/maintenance" || href.startsWith("/admin/drivers") || href.startsWith("/admin/vehicles") || href.startsWith("/admin/my-vehicle")) return "Fleet Management";
  if (href.startsWith("/admin/milk-collection")) return "Milk & Dairy";
  if (href === "/admin/machinery-rental/diesel") return "Fuel Management";
  if (href.startsWith("/admin/machinery-rental")) return "Machinery";
  if (href.startsWith("/admin/products") || ["/admin/categories", "/admin/brands", "/admin/companies", "/admin/rate-master"].includes(href)) return "Product Management";
  if (href.startsWith("/admin/inventory") || href.startsWith("/admin/stock-") || href.startsWith("/admin/agri-returns")) return "Inventory & Warehouse";
  if (href.startsWith("/admin/farmers") || href.startsWith("/admin/farmer-") || href.startsWith("/admin/wallets") || href.startsWith("/admin/payouts")) return "Farmers";
  if (href.startsWith("/admin/dealers") || href.startsWith("/admin/dealer-orders")) return "Dealers";
  if (href.startsWith("/admin/buyers")) return "Buyers";
  if (href.startsWith("/admin/suppliers")) return "Suppliers";
  if (href.startsWith("/admin/crm") || href === "/admin/messages") return "CRM";
  if (href.startsWith("/admin/reports")) return "Reports & Analytics";
  if (["/admin/reconciliation", "/admin/leakage", "/admin/audit-trail", "/admin/anomalies", "/admin/field-watch", "/admin/activity-logs", "/admin/errors", "/admin/stock-count", "/admin/submissions"].includes(href)) return "Audit & Control";
  if (href.startsWith("/admin/hr") || href.startsWith("/admin/my-hr") || href.startsWith("/admin/my-attendance") || href.startsWith("/admin/my-department") || href.startsWith("/admin/job-") || href === "/admin/staff-khata" || href === "/admin/my-wallet") return "HR & Staff";
  if (href.startsWith("/admin/bridge-ai") || href === "/admin/ai-instructions" || href === "/admin/ai-usage") return "Bridge AI";
  if (["/admin/dashboard", "/admin/hero-slides", "/admin/blog", "/admin/testimonials", "/admin/gallery", "/admin/media-library", "/admin/faqs", "/admin/static-pages", "/admin/menus", "/admin/contact-messages", "/admin/investor-inquiries", "/admin/email-templates", "/admin/settings"].includes(href)) return "Website";
  if (href.startsWith("/admin/pos") || href === "/admin/bridge-orders" || href === "/admin/produce-orders" || href === "/admin/khata" || href === "/admin/settlements") return "Sales & POS";
  if (href.startsWith("/admin/finance") || href.startsWith("/admin/cash-") || href.startsWith("/admin/bank-") || ["/admin/money-trail", "/admin/shaam-ka-hisaab", "/admin/quantity-money", "/admin/kharche", "/admin/load-bill", "/admin/company-expenses", "/admin/credit-requests"].includes(href)) return "Finance & Accounting";
  return "Administration & Security";
}

// Database registry unavailable ho to bhi final, duplication-free structure
// hi nazar aaye. Ek route ek hi canonical department mein jata hai.
const UNIQUE_FALLBACK_ITEMS = [...new Map(
  LEGACY_ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.href, item])
).values()];

export const ADMIN_NAV_GROUPS: NavGroup[] = FINAL_DEPARTMENTS.map((label) => ({
  label,
  items: UNIQUE_FALLBACK_ITEMS.filter((item) => canonicalDepartment(item.href) === label),
})).filter((group) => group.items.length > 0);

export const ADMIN_NAV: NavItem[] = [DASHBOARD_ITEM, ...ADMIN_NAV_GROUPS.flatMap((g) => g.items)];
