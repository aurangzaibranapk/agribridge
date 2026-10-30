/**
 * Kisan Pakistan vision card — ek hi card, role badge aur LIVE chips badalte hain.
 * Marketplace aur loan har role par "jald aa raha hai".
 */

const ADMIN = new Set(["admin", "owner", "super_admin", "admin_assistant"]);

const CHIPS: Record<string, string[]> = {
  farmer: ["Digital Munshi", "Dairy doodh", "Orders", "Khata / Wallet", "Vet reminders"],
  customer: ["Orders", "Khata / Wallet", "Shop", "Dairy doodh"],
  admin: ["Digital Munshi", "Dairy doodh", "Orders", "Approvals", "Staff / Admin desk"],
  staff: ["Hazri", "Tasks", "Orders", "Khata / Wallet", "Staff desk"],
  mca: ["Dairy doodh", "Route pickup", "Kisan list"],
  mco: ["Dairy doodh", "Receive", "Tanks", "Fat check"],
  vet: ["Vet reminders", "Visits", "Janwar", "Dairy doodh"],
  dealer: ["Orders", "Khata / Wallet", "Stock"],
  supplier: ["Orders", "Ledger"],
};

const LABELS: Record<string, string> = {
  farmer: "Kisan",
  customer: "Customer",
  admin: "Admin",
  owner: "Owner",
  super_admin: "Admin",
  admin_assistant: "Admin",
  staff: "Staff",
  mca: "MCA",
  mco: "MCO",
  vet: "Vet",
  dealer: "Dealer",
  supplier: "Supplier",
};

function chipKey(role: string | null | undefined): string {
  const key = String(role ?? "").trim().toLowerCase();
  if (key === "customer") return "customer";
  if (ADMIN.has(key)) return "admin";
  if (CHIPS[key]) return key;
  return "staff";
}

export function liveChipsFor(role: string | null | undefined): string[] {
  return CHIPS[chipKey(role)] ?? CHIPS.staff;
}

export function visionRoleLabel(role: string | null | undefined): string {
  const key = String(role ?? "").trim().toLowerCase();
  return LABELS[key] || "Staff";
}

export const VISION_SUB = "Kisan ka wasila · Ek app — kisan, customer, staff, admin · web jaisa live data";
export const VISION_NEXT = ["Marketplace", "Loan sahulat"] as const;
export const VISION_AHEAD = "Agay: fasal marketplace — dealer ko zero payment risk";
