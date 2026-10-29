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
    title: "Kisan / Customer",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "munshi", label: "Munshi" },
      { key: "add", label: "Add" },
      { key: "services", label: "Services" },
      { key: "more", label: "Profile" },
    ],
  },
  customer: {
    title: "Kisan / Customer",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "munshi", label: "Munshi" },
      { key: "add", label: "Add" },
      { key: "services", label: "Services" },
      { key: "more", label: "Profile" },
    ],
  },
  staff: {
    title: "Staff",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "work", label: "My Work" },
      { key: "tasks", label: "Tasks" },
      { key: "hr", label: "HR" },
      { key: "profile", label: "Profile" },
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
    title: "DCA / Milk Collection",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "work", label: "My Work" },
      { key: "farmers", label: "Farmers" },
      { key: "hr", label: "HR" },
      { key: "profile", label: "Profile" },
    ],
  },
  mco: {
    title: "MCO",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "work", label: "My Work" },
      { key: "receiving", label: "Receiving" },
      { key: "hr", label: "HR" },
      { key: "profile", label: "Profile" },
    ],
  },
  admin: {
    title: "Admin",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "work", label: "Work" },
      { key: "approvals", label: "Approvals" },
      { key: "hr", label: "HR" },
      { key: "profile", label: "Profile" },
    ],
  },
  vet: {
    title: "Vet",
    phase1: true,
    tabs: [
      { key: "home", label: "Home" },
      { key: "work", label: "My Work" },
      { key: "visits", label: "Visits" },
      { key: "hr", label: "HR" },
      { key: "profile", label: "Profile" },
    ],
  },
};

export function tabsFor(role: AppRole): TabSpec[] {
  return ROLE_NAV[role].tabs;
}
