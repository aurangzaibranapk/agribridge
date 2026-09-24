import {
  LayoutDashboard, FileText, Quote, Image as ImageIcon, HelpCircle, Mail, Handshake, Sliders, Menu as MenuIcon, FileCode, UserCog, History, Package, Wheat, FolderOpen, Tag, Layers, Building2, ShoppingCart, Wallet, BarChart3, Truck, ClipboardList, Boxes, Droplet, Store, ArrowLeftRight, Users, PackageSearch, LineChart, PiggyBank, Sprout, Bug, Leaf, Beef, ShoppingBasket, Landmark, Contact, Globe, ShoppingBag, HandCoins, CircleDollarSign, CreditCard, FileCheck, Calculator, Bell, List, MapPin, Briefcase, ShieldCheck, AlertTriangle, Bike, Zap, Wrench, Receipt, ClipboardCheck, PackagePlus, WalletCards, LayoutGrid, MailPlus, Home, ClipboardType, FileBarChart, ReceiptText, Scale, FileSpreadsheet, Sparkles, IdCard, Bot, SlidersHorizontal, MessageCircle, Trash2, Undo2, Inbox, Circle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Icon ka naam database mein rehta hai, us ka component yahan.
 *
 * Poori lucide library import karna aasan hota, magar us se browser par
 * bhejne wala bojh kai guna barh jata -- gaon ke network par har safha
 * us ka kharaj deta. Is liye sirf wahi icon yahan hain jo waqai istemal
 * hote hain.
 *
 * Naya icon database mein daalein aur yahan na ho, to safha girta nahi:
 * ek aam sa nishan lag jata hai. Menu ka ek icon ghalat hona koi bara
 * masla nahi; menu ka ghayab ho jana bara masla hai.
 */
export const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  Quote,
  ImageIcon,
  HelpCircle,
  Mail,
  Handshake,
  Sliders,
  MenuIcon,
  FileCode,
  UserCog,
  History,
  Package,
  Wheat,
  FolderOpen,
  Tag,
  Layers,
  Building2,
  ShoppingCart,
  Wallet,
  BarChart3,
  Truck,
  ClipboardList,
  Boxes,
  Droplet,
  Store,
  ArrowLeftRight,
  Users,
  PackageSearch,
  LineChart,
  PiggyBank,
  Sprout,
  Bug,
  Leaf,
  Beef,
  ShoppingBasket,
  Landmark,
  Contact,
  Globe,
  ShoppingBag,
  HandCoins,
  CircleDollarSign,
  CreditCard,
  FileCheck,
  Calculator,
  Bell,
  List,
  MapPin,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
  Bike,
  Zap,
  Wrench,
  Receipt,
  ClipboardCheck,
  PackagePlus,
  WalletCards,
  LayoutGrid,
  MailPlus,
  Home,
  ClipboardType,
  FileBarChart,
  ReceiptText,
  Scale,
  FileSpreadsheet,
  Sparkles,
  IdCard,
  Bot,
  SlidersHorizontal,
  MessageCircle,
  Trash2,
  Undo2,
  Inbox,
};

export const FALLBACK_ICON: LucideIcon = Circle;

export function iconByName(name: string | null | undefined): LucideIcon {
  if (!name) return FALLBACK_ICON;
  return ICONS[name] ?? FALLBACK_ICON;
}