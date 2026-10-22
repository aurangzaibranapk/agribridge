import type { AppRole } from "./roles";

export interface TabSpec {
  key: string;
  label: string;
}

export interface RoleNav {
  title: string;
  /** Phase 1 mein kaam karta hai. Baqi shell hai, agli phase. */
  phase1: boolean;
  tabs: TabSpec[];
}

/**
 * Manzoor-shuda mockup ka neeche wala navigation.
 * Har role sirf apni fehrist load karta hai.
 */
export const ROLE_NAV: Record<AppRole, RoleNav> = {
  farmer: {
    title: "Kisan",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "doodh", label: "Doodh" },
      { key: "khata", label: "Khata" },
      { key: "vet", label: "Vet" },
      { key: "karyana", label: "Karyana" },
    ],
  },
  customer: {
    title: "Customer",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "shop", label: "Shop" },
      { key: "orders", label: "Orders" },
      { key: "khata", label: "Khata" },
      { key: "more", label: "More" },
    ],
  },
  staff: {
    title: "Staff",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "visits", label: "Visits" },
      { key: "orders", label: "Orders" },
      { key: "khata", label: "Khata" },
      { key: "more", label: "More" },
    ],
  },
  supplier: {
    title: "Supplier",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "orders", label: "Orders" },
      { key: "ledger", label: "Ledger" },
      { key: "more", label: "More" },
    ],
  },
  dealer: {
    title: "Dealer",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "orders", label: "Orders" },
      { key: "khata", label: "Khata" },
      { key: "more", label: "More" },
    ],
  },
  mca: {
    title: "MCA",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "route", label: "Route" },
      { key: "fuel", label: "Fuel" },
      { key: "drop", label: "Drop" },
      { key: "more", label: "More" },
    ],
  },
  mco: {
    title: "MCO",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "fat", label: "Check" },
      { key: "drop", label: "Shift" },
      { key: "totals", label: "Reports" },
      { key: "more", label: "Alerts" },
    ],
  },
  admin: {
    title: "Admin",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "approvals", label: "Approvals" },
      { key: "reports", label: "Reports" },
      { key: "more", label: "More" },
    ],
  },
  vet: {
    title: "Vet",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "visits", label: "Visits" },
      { key: "stock", label: "Stock" },
      { key: "more", label: "More" },
    ],
  },
};

export function tabsFor(role: AppRole): TabSpec[] {
  return ROLE_NAV[role].tabs;
}
