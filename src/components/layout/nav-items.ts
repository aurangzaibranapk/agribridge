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

export const DASHBOARD_ITEM: NavItem = { href: "/admin/command-center", label: "Malik ka Command Center", icon: Scale };

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Business",
    items: [
      { href: "/admin/farmers", label: "Kisan", icon: Wheat },
      { href: "/admin/dealers", label: "Dealer", icon: Users },
      { href: "/admin/buyers", label: "Kharidar", icon: ShoppingBag },
      { href: "/admin/suppliers", label: "Supplier", icon: Truck },
      { href: "/admin/suppliers/all-statement", label: "Sab Suppliers Statement", icon: FileBarChart },
      { href: "/admin/investors", label: "Sarmayakar", icon: PiggyBank },
      { href: "/admin/branches", label: "Shaakhein", icon: Store },
      { href: "/admin/branches/locations", label: "Shaakh ki Jagah", icon: MapPin },
      { href: "/admin/shops", label: "Dukanein", icon: Store },
      { href: "/admin/shop-rent", label: "Dukan ka Kiraya aur Bill", icon: Home },
      { href: "/admin/drivers", label: "Driver aur Gaariyan", icon: IdCard },
      { href: "/admin/vehicles", label: "Gaariyan (Rozana)", icon: Bike },
      { href: "/admin/crm", label: "Gahak ka Khata", icon: Contact },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/pos", label: "POS", icon: ShoppingCart },
      { href: "/admin/agri-orders", label: "AgriBridge Ordering", icon: ClipboardType },
      { href: "/admin/bridge-orders", label: "Order", icon: PackageSearch },
      { href: "/admin/produce-orders", label: "Fasal ke Order", icon: HandCoins },
      { href: "/admin/dealer-orders", label: "Dealer ke Order", icon: ClipboardList },
    ],
  },
  {
    label: "Purchases",
    items: [
      { href: "/admin/purchases", label: "Kharid", icon: ClipboardList },
      { href: "/admin/grain-procurement/dashboard", label: "Anaj ka Dashboard", icon: LineChart },
      { href: "/admin/grain-procurement", label: "Anaj ki Kharid", icon: Wheat },
      { href: "/admin/grain-procurement/sell", label: "Grain Bechein (Sell)", icon: HandCoins },
      { href: "/admin/grain-procurement/payments", label: "Kisan ki Adaigi", icon: Wallet },
      { href: "/admin/grain-procurement/warehouse", label: "Anaj ka Godam", icon: Building2 },
      { href: "/admin/grain/leads", label: "Machinery se Grain Leads", icon: ClipboardList },
      { href: "/admin/ai-suggestions", label: "AI ki Kharid Tajweez", icon: Bot },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/admin/products", label: "Cheezein", icon: Package },
      { href: "/admin/products/setup", label: "Product Setup", icon: ListChecks },
      { href: "/admin/products/masters", label: "Product ki Bunyadi Fehrist", icon: Layers },
      { href: "/admin/inventory", label: "Stock", icon: Boxes },
      { href: "/admin/stock-ledger", label: "Stock ka Khata", icon: List },
      { href: "/admin/stock-transfers", label: "Maal Bhejein (Transfer)", icon: ArrowLeftRight },
      { href: "/admin/agri-returns", label: "Wapsi ka Maal", icon: Undo2 },
      { href: "/admin/stock-count", label: "Maal ki Ginti", icon: ClipboardCheck },
      { href: "/admin/inventory/warehouses", label: "Godam", icon: Building2 },
      { href: "/admin/inventory/receiving", label: "Maal Aana (Receiving)", icon: PackageCheck },
    ],
  },
  {
    label: "Agriculture",
    items: [
      { href: "/admin/fertilizer", label: "Khaad", icon: Sprout },
      { href: "/admin/pesticide", label: "Spray (Zehar)", icon: Bug },
      { href: "/admin/seeds", label: "Beej", icon: Leaf },
      { href: "/admin/wanda", label: "Wanda", icon: Beef },
      { href: "/admin/machinery-rental/dashboard", label: "Machinery Dashboard", icon: LineChart },
      { href: "/admin/machinery-rental", label: "Machine ki Booking", icon: Wrench },
      { href: "/admin/machinery-rental/list", label: "Tamam Bookings", icon: List },
      { href: "/admin/machinery-rental/reports", label: "Machinery Reports", icon: FileBarChart },
      { href: "/admin/grocery", label: "Grocery", icon: ShoppingBasket },
    ],
  },
  {
    label: "Dairy",
    items: [
      { href: "/admin/milk-collection/collect", label: "Doodh Jama Karein", icon: Droplet },
      { href: "/admin/milk-collection/walk-in", label: "Khud Laaya Hua Doodh", icon: Store },
      { href: "/admin/milk-collection/chiller", label: "Chiller — FAT", icon: Droplet },
      { href: "/admin/milk-collection/verify", label: "Doodh ki Tasdeeq", icon: ClipboardCheck },
      { href: "/admin/milk-collection", label: "Doodh Collection", icon: Droplet },
      { href: "/admin/milk-collection/routes", label: "Route aur Kami", icon: AlertTriangle },
      { href: "/admin/milk-collection/fuel", label: "Tel ka Hisaab", icon: Bike },
      { href: "/admin/milk-collection/generator", label: "Generator ka Hisaab", icon: Zap },
      { href: "/admin/milk-collection/maintenance", label: "Gaari aur Marammat", icon: Wrench },
      { href: "/admin/milk-collection/cost-per-liter", label: "Fi Litre Kharcha", icon: Calculator },
      { href: "/admin/milk-collection/billing", label: "Company Billing aur Nafa", icon: Receipt },
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
      { href: "/admin/audit-trail", label: "Kis Ne Kya Kiya", icon: History },
      { href: "/admin/anomalies", label: "Ghair-maamooli Tarteeb", icon: Bell },
      { href: "/admin/master-dashboard", label: "Master Dashboard", icon: Scale },
      { href: "/admin/reports/pnl", label: "Nafa Nuqsan (Shop-wise)", icon: LineChart },
      { href: "/admin/finance/queue", label: "Finance ki Qatar", icon: CreditCard },
      { href: "/admin/finance/payment-mapping", label: "Adaigi ka Tareeqa", icon: CreditCard },
      { href: "/admin/kharche", label: "Paisa & Khata", icon: ReceiptText },
      { href: "/admin/load-bill", label: "Load & Bill", icon: Smartphone },
      { href: "/admin/settlements", label: "Khaton ka Adjustment", icon: Scale },
      { href: "/admin/finance", label: "Cash Book", icon: Landmark },
      { href: "/admin/finance/banks", label: "Bank", icon: Landmark },
      { href: "/admin/khata", label: "Khata", icon: Wallet },
      { href: "/admin/staff-khata", label: "Staff Khata", icon: WalletCards },
      { href: "/admin/branch-credit", label: "Shop ka Udhaar aur Advance", icon: WalletCards },
      { href: "/admin/credit-requests", label: "Udhaar ki Darkhwastein", icon: FileCheck },
      { href: "/admin/farmer-credit", label: "Kisan ka Udhaar", icon: CreditCard },
      { href: "/admin/farmer-loans", label: "Kisan ke Qarze", icon: HandCoins },
      { href: "/admin/wallets", label: "Batwe", icon: Wallet },
      { href: "/admin/my-wallet", label: "Mera Batwa", icon: Wallet },
      { href: "/admin/payouts", label: "Adaigiyan", icon: CircleDollarSign },
    ],
  },
  {
    label: "Rates",
    items: [{ href: "/admin/rate-master", label: "Rate Master", icon: Calculator }],
  },
  {
    label: "Reports",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/reports/milk", label: "Doodh Report", icon: Droplet },
      { href: "/admin/reports/sales", label: "Sale Report", icon: ShoppingCart },
      { href: "/admin/reports/purchases", label: "Kharid Report", icon: ClipboardList },
      { href: "/admin/reports/inventory", label: "Stock Reports", icon: Boxes },
      { href: "/admin/reports/finance", label: "Finance Report", icon: Landmark },
      { href: "/admin/reports/credit", label: "Udhaar Report", icon: CreditCard },
      { href: "/admin/reports/procurement", label: "Anaj Kharid Report", icon: Wheat },
      { href: "/admin/reports/audit", label: "Audit Center (Nuqsan)", icon: AlertTriangle },
    ],
  },
  {
    label: "Website CMS",
    items: [
      { href: "/admin/dashboard", label: "Website Dashboard", icon: LayoutDashboard },
      { href: "/admin/hero-slides", label: "Hero Slider", icon: Sliders },
      { href: "/admin/blog", label: "Blog", icon: FileText },
      { href: "/admin/testimonials", label: "Gahakon ki Raye", icon: Quote },
      { href: "/admin/gallery", label: "Tasveerein", icon: ImageIcon },
      { href: "/admin/media-library", label: "Media", icon: FolderOpen },
      { href: "/admin/faqs", label: "Aam Sawalat", icon: HelpCircle },
      { href: "/admin/static-pages", label: "Safhe", icon: FileCode },
      { href: "/admin/menus", label: "Menu", icon: MenuIcon },
      { href: "/admin/contact-messages", label: "Website ke Paighaam", icon: Mail },
      { href: "/admin/investor-inquiries", label: "Sarmayakar ke Sawal", icon: Handshake },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/messages", label: "Paighaam", icon: MessageCircle },
      { href: "/admin/bridge-ai", label: "Bridge AI", icon: Sparkles },
      { href: "/admin/bridge-ai/activity-log", label: "Bridge AI Activity Log", icon: History },
      { href: "/admin/bridge-ai/action-requests", label: "Bridge AI Action Requests", icon: ClipboardCheck },
      { href: "/admin/ai-instructions", label: "AI ki Hidayaat", icon: SlidersHorizontal },
      { href: "/admin/ai-usage", label: "AI ka khata", icon: CircleDollarSign },
      { href: "/admin/platform", label: "Platform / Clients", icon: Globe },
      { href: "/admin/job-vacancies", label: "Naukri ki Jagahein", icon: Briefcase },
      { href: "/admin/job-applications", label: "Naukri ki Darkhwastein", icon: FileCheck },
      { href: "/admin/hr-dashboard", label: "HR Dashboard", icon: LayoutGrid },
      { href: "/admin/email-templates", label: "Email ke Namune", icon: MailPlus },
      { href: "/admin/hr", label: "Staff (HR)", icon: UserCog },
      { href: "/admin/hr/whatsapp", label: "Staff WhatsApp", icon: MessageCircle },
      { href: "/admin/hr/attendance-log", label: "Hazri Record", icon: ClipboardCheck },
      { href: "/admin/hr/attendance/board", label: "Hazri Board", icon: AlertTriangle },
      { href: "/admin/submissions", label: "Manzoori Inbox", icon: Inbox },
      { href: "/admin/field-watch", label: "Maidan ki Nigrani", icon: AlertTriangle },
      { href: "/admin/dashboard-manager", label: "Dashboard aur Feature Manager", icon: LayoutGrid },
      { href: "/admin/my-department", label: "Meri Team (Head)", icon: Users },
      { href: "/admin/staff-access", label: "Staff & Access Control", icon: ShieldCheck },
      { href: "/admin/users", label: "Users aur Role", icon: UserCog },
      { href: "/admin/notifications", label: "Ittila'at", icon: Bell },
      { href: "/admin/activity-logs", label: "Kaam ka Record", icon: History },
      { href: "/admin/settings", label: "Website Settings", icon: Sliders },
      { href: "/admin/reset-test-data", label: "Test Data Reset", icon: Trash2 },
    ],
  },
];

export const ADMIN_NAV: NavItem[] = [DASHBOARD_ITEM, ...ADMIN_NAV_GROUPS.flatMap((g) => g.items)];