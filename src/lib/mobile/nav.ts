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
      { key: "khata", label: "Wallet" },
      { key: "more", label: "Profile" },
    ],
  },
  customer: {
    title: "Customer",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "shop", label: "Order" },
      { key: "orders", label: "Orders" },
      { key: "more", label: "Profile" },
    ],
  },
  staff: {
    title: "Staff",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "visits", label: "Hazri" },
      { key: "orders", label: "Tasks" },
      { key: "more", label: "Profile" },
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
      { key: "orders", label: "Order" },
      { key: "khata", label: "Khata" },
      { key: "more", label: "Profile" },
    ],
  },
  mca: {
    title: "MCA",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "route", label: "Entry" },
      { key: "fuel", label: "Kisan" },
      { key: "more", label: "Profile" },
    ],
  },
  mco: {
    title: "MCO",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "fat", label: "Receive" },
      { key: "drop", label: "Tanks" },
      { key: "more", label: "Profile" },
    ],
  },
  admin: {
    title: "Admin",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "reports", label: "Reports" },
      { key: "approvals", label: "Approve" },
      { key: "more", label: "More" },
    ],
  },
  vet: {
    title: "Vet",
    phase1: false,
    tabs: [
      { key: "home", label: "Home" },
      { key: "visits", label: "Visits" },
      { key: "stock", label: "Janwar" },
      { key: "more", label: "Profile" },
    ],
  },
};

export function tabsFor(role: AppRole): TabSpec[] {
  return ROLE_NAV[role].tabs;
}
