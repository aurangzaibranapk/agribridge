import {
  LayoutDashboard, FileText, Quote, Image as ImageIcon, HelpCircle,
  Mail, Handshake, Sliders, Menu as MenuIcon, FileCode, UserCog, History, Package, Wheat, FolderOpen, Tag, Layers, Building2, ShoppingCart, Wallet, BarChart3, Truck, ClipboardList, Boxes, Droplet, Store, ArrowLeftRight, Users, PackageSearch, LineChart, PiggyBank, Sprout, Bug, Leaf, Beef, ShoppingBasket, Landmark, Contact, Globe, ShoppingBag, HandCoins, CircleDollarSign, CreditCard, FileCheck, Calculator, Bell, List, MapPin, Briefcase, ShieldCheck, AlertTriangle, Bike, Zap, Wrench, Receipt, ClipboardCheck, PackagePlus, WalletCards, LayoutGrid, MailPlus, Home, ClipboardType, FileBarChart, ReceiptText, Scale, FileSpreadsheet, Sparkles, IdCard, Bot, SlidersHorizontal, MessageCircle, Trash2, Undo2, Inbox,
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

export const ADMIN_NAV_GROUPS: NavGroup[] = [
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
      { href: "/admin/agri-orders", label: "AgriBridge Ordering", icon: ClipboardType },
      { href: "/admin/ai-suggestions", label: "AI Purchase Suggestions", icon: Bot },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/products/propose", label: "Propose Product", icon: PackagePlus },
      { href: "/admin/products/pending", label: "Pending Products", icon: ClipboardCheck },
      { href: "/admin/products/pending-edits", label: "Pending Product Edits", icon: ClipboardCheck },
      { href: "/admin/products/catalog-export", label: "Product Catalog Export", icon: FileSpreadsheet },
      { href: "/admin/inventory", label: "Stock", icon: Boxes },
      { href: "/admin/agri-orders", label: "AgriBridge Ordering", icon: ClipboardType },
      { href: "/admin/agri-returns", label: "Returns (Shop se HQ)", icon: Undo2 },
      { href: "/admin/stock-transfers", label: "Stock Transfers", icon: ArrowLeftRight },
      { href: "/admin/stock-ledger", label: "Stock Ledger", icon: List },
      { href: "/admin/categories", label: "Categories", icon: Layers },
      { href: "/admin/brands", label: "Brands", icon: Tag },
      { href: "/admin/companies", label: "Companies", icon: Building2 },
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
      { href: "/admin/command-center", label: "Owner Command Center", icon: Scale },
      { href: "/admin/money-trail", label: "Paisa Kahan Hai (Money Trail)", icon: Scale },
      { href: "/admin/cash-close", label: "Raat ki Cash Ginti", icon: Calculator },
      { href: "/admin/cash-handover", label: "Cash Haath Badalna", icon: ArrowLeftRight },
      { href: "/admin/bank-reconcile", label: "Bank se Milaan", icon: Landmark },
      { href: "/admin/stock-count", label: "Maal ki Ginti", icon: PackageSearch },
      { href: "/admin/quantity-money", label: "Miqdar aur Paisa", icon: Scale },
      { href: "/admin/reconciliation", label: "Roz ka Milaan", icon: ClipboardCheck },
      { href: "/admin/leakage", label: "Paisa Kahan Se Nikal Raha Hai", icon: AlertTriangle },
      { href: "/admin/audit-trail", label: "Kis Ne Kya Kiya", icon: History },
      { href: "/admin/anomalies", label: "Ghair-maamooli Tarteeb", icon: Bell },
      { href: "/admin/cash-close", label: "Raat ki Cash Ginti", icon: Landmark },
      { href: "/admin/master-dashboard", label: "Master Dashboard", icon: Scale },
      { href: "/admin/reports/pnl", label: "Profit & Loss (Shop-wise)", icon: LineChart },
      { href: "/admin/finance/queue", label: "Finance Queue", icon: CreditCard },
      { href: "/admin/finance/payment-mapping", label: "Payment Method Mapping", icon: CreditCard },
      { href: "/admin/agri-orders", label: "AgriBridge Ordering", icon: ClipboardType },
      { href: "/admin/company-expenses", label: "Company Expenses", icon: ReceiptText },
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
      { href: "/admin/ai-suggestions", label: "AI Purchase Suggestions", icon: Bot },
      { href: "/admin/ai-instructions", label: "AI Instructions", icon: SlidersHorizontal },
      { href: "/admin/platform", label: "Platform / Clients", icon: Globe },
      { href: "/admin/job-vacancies", label: "Job Vacancies", icon: Briefcase },
      { href: "/admin/job-applications", label: "Job Applications", icon: FileCheck },
      { href: "/admin/hr-dashboard", label: "HR Dashboard", icon: LayoutGrid },
      { href: "/admin/email-templates", label: "Email Templates", icon: MailPlus },
      { href: "/admin/my-attendance", label: "My Attendance", icon: MapPin },
      { href: "/admin/hr", label: "HR - Staff", icon: UserCog },
      { href: "/admin/hr/whatsapp", label: "Staff WhatsApp", icon: MessageCircle },
      { href: "/admin/hr/attendance-log", label: "Hazri Record", icon: ClipboardCheck },
      { href: "/admin/submissions", label: "Approval Inbox", icon: Inbox },
      { href: "/admin/field-watch", label: "Maidan ki Nigrani", icon: AlertTriangle },
      { href: "/admin/dashboard-manager", label: "Dashboard & Feature Manager", icon: LayoutGrid },
      { href: "/admin/departments", label: "Department aur Ijazat", icon: ShieldCheck },
      { href: "/admin/my-department", label: "Meri Team (Head)", icon: Users },
      { href: "/admin/permissions", label: "Ek Banday ki Ijazat", icon: UserCog },
      { href: "/admin/product-permissions", label: "Product Permissions", icon: ShieldCheck },
      { href: "/admin/users", label: "Users & Roles", icon: UserCog },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/activity-logs", label: "Activity Logs", icon: History },
      { href: "/admin/settings", label: "Website Settings", icon: Sliders },
      { href: "/admin/reset-test-data", label: "Reset Test Data", icon: Trash2 },
    ],
  },
];

export const ADMIN_NAV: NavItem[] = [DASHBOARD_ITEM, ...ADMIN_NAV_GROUPS.flatMap((g) => g.items)];