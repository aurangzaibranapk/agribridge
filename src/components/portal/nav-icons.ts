import { LayoutDashboard, BookOpen, ShoppingBag, HandCoins, Milk, Calculator, Dna, Syringe, MapPin, Sprout, Warehouse, PackageSearch, CalendarClock, FlaskConical, Tractor, Landmark, UserCircle, Sparkles, Menu, type LucideIcon } from "lucide-react";
import type { NavIconName } from "@/lib/portal/nav";

export const NAV_ICONS: Record<NavIconName | "more", LucideIcon> = {
  dashboard: LayoutDashboard, khata: BookOpen, bills: ShoppingBag, payments: HandCoins,
  dairy: Milk, hisaab: Calculator, breeding: Dna, health: Syringe,
  farms: MapPin, crops: Sprout, harvest: Warehouse,
  demand: PackageSearch, campaigns: CalendarClock, fertilizer: FlaskConical, machinery: Tractor, livestock: Landmark,
  profile: UserCircle, ai: Sparkles, more: Menu,
};
