export type DashboardBlueprint = {
  eyebrow: string;
  operationsTitle: string;
  operationsHint: string;
  chartTitle: string;
  coverageTitle: string;
  quickTitle: string;
  accent: "green" | "blue" | "amber" | "violet" | "rose";
};

const defaultBlueprint: DashboardBlueprint = {
  eyebrow: "Department control room",
  operationsTitle: "Core Operations",
  operationsHint: "Daily work, controls and assigned responsibilities",
  chartTitle: "Operational Mix",
  coverageTitle: "Work Coverage",
  quickTitle: "Quick Actions",
  accent: "green",
};

export const DASHBOARD_BLUEPRINTS: Record<string, DashboardBlueprint> = {
  master: { ...defaultBlueprint, eyebrow: "Executive command", operationsTitle: "Business Control", chartTitle: "Business Mix", coverageTitle: "Organization Coverage" },
  branches: { ...defaultBlueprint, eyebrow: "Network performance", operationsTitle: "Branch Operations", operationsHint: "Locations, statements and branch-level controls", chartTitle: "Branch Work Mix", coverageTitle: "Branch Coverage", accent: "blue" },
  shops: { ...defaultBlueprint, eyebrow: "Retail network", operationsTitle: "Shop Operations", operationsHint: "Shop 360, rent, credit and outlet controls", chartTitle: "Outlet Control Mix", coverageTitle: "Shop Coverage", accent: "amber" },
  sales: { ...defaultBlueprint, eyebrow: "Revenue control", operationsTitle: "Sales & POS Operations", operationsHint: "Billing, returns, settlements and customer money", chartTitle: "Sales Workflow Mix", coverageTitle: "Sales Coverage", accent: "green" },
  ordering: { ...defaultBlueprint, eyebrow: "Stock request network", operationsTitle: "Ordering Workflow", operationsHint: "Request, approval, dispatch and receiving", chartTitle: "Order Stage Mix", coverageTitle: "Ordering Coverage", accent: "blue" },
  procurement: { ...defaultBlueprint, eyebrow: "Farmer procurement", operationsTitle: "Procurement Operations", operationsHint: "Purchase entries, payments and farmer statements", chartTitle: "Procurement Mix", coverageTitle: "Procurement Coverage", accent: "amber" },
  grain: { ...defaultBlueprint, eyebrow: "Commodity business", operationsTitle: "Grain Operations", operationsHint: "Purchase, warehouse, sales and grain P&L", chartTitle: "Grain Workflow Mix", coverageTitle: "Grain Coverage", accent: "amber" },
  purchase: { ...defaultBlueprint, eyebrow: "Supplier buying", operationsTitle: "Purchase Operations", operationsHint: "Purchase orders, GRN, bills and suggestions", chartTitle: "Purchase Stage Mix", coverageTitle: "Purchase Coverage", accent: "violet" },
  milk: { ...defaultBlueprint, eyebrow: "Dairy operations", operationsTitle: "Milk Collection & Quality", operationsHint: "Collection, FAT, routes, chilling and billing", chartTitle: "Milk Workflow Mix", coverageTitle: "Dairy Coverage", accent: "blue" },
  machinery: { ...defaultBlueprint, eyebrow: "Field machinery", operationsTitle: "Machinery Operations", operationsHint: "Bookings, work, diesel and settlements", chartTitle: "Machinery Work Mix", coverageTitle: "Machinery Coverage", accent: "amber" },
  product: { ...defaultBlueprint, eyebrow: "Catalog governance", operationsTitle: "Product Operations", operationsHint: "Masters, rates, approvals and catalog quality", chartTitle: "Product Control Mix", coverageTitle: "Catalog Coverage", accent: "violet" },
  inventory: { ...defaultBlueprint, eyebrow: "Stock command", operationsTitle: "Inventory Operations", operationsHint: "Stock, batches, transfers, counts and returns", chartTitle: "Inventory Flow Mix", coverageTitle: "Inventory Coverage", accent: "blue" },
  fuel: { ...defaultBlueprint, eyebrow: "Fuel accountability", operationsTitle: "Fuel Operations", operationsHint: "Issue, consumption, cost and variance control", chartTitle: "Fuel Control Mix", coverageTitle: "Fuel Coverage", accent: "rose" },
  generator: { ...defaultBlueprint, eyebrow: "Power operations", operationsTitle: "Generator Operations", operationsHint: "Runtime, fuel usage, service and downtime", chartTitle: "Generator Work Mix", coverageTitle: "Generator Coverage", accent: "amber" },
  fleet: { ...defaultBlueprint, eyebrow: "Logistics command", operationsTitle: "Fleet Operations", operationsHint: "Vehicles, drivers, routes and maintenance", chartTitle: "Fleet Work Mix", coverageTitle: "Fleet Coverage", accent: "blue" },
  farmers: { ...defaultBlueprint, eyebrow: "Farmer relationship", operationsTitle: "Farmer 360 Operations", operationsHint: "Profiles, wallets, loans, credit and statements", chartTitle: "Farmer Service Mix", coverageTitle: "Farmer Coverage", accent: "green" },
  dealers: { ...defaultBlueprint, eyebrow: "Dealer network", operationsTitle: "Dealer Operations", operationsHint: "Profiles, orders, credit and statements", chartTitle: "Dealer Work Mix", coverageTitle: "Dealer Coverage", accent: "violet" },
  buyers: { ...defaultBlueprint, eyebrow: "Buyer network", operationsTitle: "Buyer Operations", operationsHint: "Profiles, purchases, receivables and statements", chartTitle: "Buyer Work Mix", coverageTitle: "Buyer Coverage", accent: "blue" },
  suppliers: { ...defaultBlueprint, eyebrow: "Supply network", operationsTitle: "Supplier Operations", operationsHint: "Profiles, purchases, payments and performance", chartTitle: "Supplier Work Mix", coverageTitle: "Supplier Coverage", accent: "amber" },
  crm: { ...defaultBlueprint, eyebrow: "Relationship pipeline", operationsTitle: "CRM Operations", operationsHint: "Leads, messages, follow-ups and conversion", chartTitle: "CRM Pipeline Mix", coverageTitle: "CRM Coverage", accent: "violet" },
  finance: { ...defaultBlueprint, eyebrow: "Financial command", operationsTitle: "Finance Operations", operationsHint: "Cash, banks, accounting, budgets and controls", chartTitle: "Finance Work Mix", coverageTitle: "Finance Coverage", accent: "green" },
  hr: { ...defaultBlueprint, eyebrow: "People operations", operationsTitle: "HR Operations", operationsHint: "Staff, attendance, leave and employment", chartTitle: "People Work Mix", coverageTitle: "HR Coverage", accent: "violet" },
  audit: { ...defaultBlueprint, eyebrow: "Risk & compliance", operationsTitle: "Audit Operations", operationsHint: "Approvals, reconciliation, exceptions and evidence", chartTitle: "Control Mix", coverageTitle: "Audit Coverage", accent: "rose" },
  reports: { ...defaultBlueprint, eyebrow: "Business intelligence", operationsTitle: "Reports & Analytics", chartTitle: "Reporting Mix", coverageTitle: "Report Coverage", accent: "blue" },
  website: { ...defaultBlueprint, eyebrow: "Digital presence", operationsTitle: "Website & CMS", operationsHint: "Pages, media, enquiries and publishing", chartTitle: "Content Mix", coverageTitle: "Website Coverage", accent: "blue" },
  ai: { ...defaultBlueprint, eyebrow: "Intelligence command", operationsTitle: "Bridge AI Operations", operationsHint: "Suggestions, actions, usage and human escalation", chartTitle: "AI Work Mix", coverageTitle: "AI Coverage", accent: "violet" },
  admin: { ...defaultBlueprint, eyebrow: "Platform governance", operationsTitle: "Administration & Security", operationsHint: "Users, access, configuration and platform health", chartTitle: "Governance Mix", coverageTitle: "Admin Coverage", accent: "rose" },
};

export function blueprintFor(key: string): DashboardBlueprint {
  return DASHBOARD_BLUEPRINTS[key] ?? defaultBlueprint;
}
