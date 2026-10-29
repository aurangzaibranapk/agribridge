export type WorkKey = "karyana" | "finance" | "warehouse" | "purchase" | "milk" | "vet" | "grain" | "delivery";

export type WorkAccessInput = {
  portalRole?: string | null;
  appRole?: string | null;
  designation?: string | null;
  department?: string | null;
  featureKeys?: string[] | null;
};

export const WORK_LABELS: Record<WorkKey, string> = {
  karyana: "Karyana / POS",
  finance: "Finance",
  warehouse: "Warehouse",
  purchase: "Purchase",
  milk: "Milk Operations",
  vet: "Vet Team",
  grain: "Grain",
  delivery: "Delivery",
};

const ALL_WORK: WorkKey[] = ["karyana", "finance", "warehouse", "purchase", "milk", "vet", "grain", "delivery"];

const MATCHERS: Record<WorkKey, RegExp> = {
  karyana: /karyana|pos|sale|shop|load|udhaar|recovery|cash.?handover|stock.?count/,
  finance: /finance|account|payment|bank|ledger|cash|recovery|payable|receivable/,
  warehouse: /warehouse|godam|inventory|stock|grn|expiry|transfer/,
  purchase: /purchase|procurement|supplier|payable|grn/,
  milk: /milk|mca|mco|chiller|dca|dco|collection/,
  vet: /\bvet\b|veterinary|animal|dairy.?health|vaccin|treatment/,
  grain: /grain|wheat|rice|maize|gandum|chawal|procurement/,
  delivery: /delivery|dispatch|rider|transport|order.?delivery/,
};

function normalized(input: WorkAccessInput): string {
  return [input.portalRole, input.appRole, input.designation, input.department, ...(input.featureKeys || [])]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/** Admin ko sab; baqi ko sirf role/department/permission se sabit workspace. */
export function resolveWorkspaces(input: WorkAccessInput): WorkKey[] {
  const role = String(input.portalRole || "").trim().toLowerCase();
  const appRole = String(input.appRole || "").trim().toLowerCase();
  if (["owner", "super_admin", "admin", "admin_assistant"].includes(role) || appRole === "admin") return [...ALL_WORK];
  if (appRole === "mca" || appRole === "mco" || role === "milk_collection") return ["milk"];
  if (appRole === "vet" || role === "agronomist") return ["vet"];
  const hay = normalized(input);
  return ALL_WORK.filter((key) => MATCHERS[key].test(hay));
}

export function primaryWorkspace(input: WorkAccessInput): WorkKey | null {
  return resolveWorkspaces(input)[0] || null;
}

export function internalHrAllowed(appRole: string | null | undefined): boolean {
  return ["admin", "staff", "mca", "mco", "vet"].includes(String(appRole || ""));
}
