import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import {
  PAPER_SPECS,
  adjustedTotal,
  baselineForDestination,
  chillerDayIntake,
  chillerIntake,
  dayDestinationSummary,
  formulaFromRateRow,
  parseDestination,
  parseHandoverReason,
  parseLrBaseline,
  type ChillerIntake,
  type DayDestinationSummary,
  type HandoverDestination,
  type HandoverLineInput,
  type HandoverReason,
  type HandoverSpecs,
  type LabFormula,
  type LrBaseline,
  type SlipBucketInput,
} from "@/lib/milk-handover";
import type { HandoverPartyOption, HandoverShop } from "@/app/admin/milk-collection/handover/handover-form";

const ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];

export interface HandoverGate {
  userId: string;
  role: string;
  branchId: string | null;
  myName: string;
  canWrite: boolean;
}

export async function handoverGate(action: "view" | "create" | "edit"): Promise<HandoverGate | { error: string }> {
  const gate = await requireAction("milk-collection.handover", action === "view" ? "view" : action);
  if ("error" in gate) return gate;
  if (!ROLES.includes(gate.caller.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };
  const supabase = createClient();
  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", gate.caller.userId).maybeSingle();
  const write = action === "view" ? await requireAction("milk-collection.handover", "edit") : gate;
  return {
    userId: gate.caller.userId,
    role: gate.caller.role,
    branchId: gate.caller.branchId,
    myName: me?.full_name ?? "",
    canWrite: !("error" in write) || gate.caller.legacy,
  };
}

export interface HandoverOptions {
  branches: { id: string; name: string }[];
  shops: HandoverShop[];
  specs: HandoverSpecs;
  formula: LabFormula;
  migrationError: string | null;
}

export async function loadHandoverOptions(): Promise<HandoverOptions> {
  const supabase = createClient();
  const [{ data: branches }, { data: shops }, specsRes, settingsRes] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("shops").select("id, name, code, branch_id, business_type").eq("is_active", true).order("name"),
    supabase.from("milk_handover_specs").select("min_fat, min_lr, min_snf").eq("id", true).maybeSingle(),
    supabase.from("milk_rate_settings").select("standard_rate, self_dropoff_incentive, snf_constant, reference_ts").limit(1).maybeSingle(),
  ]);

  const dairy = (shops ?? []).filter((s) => s.business_type === "dairy");
  const shopRows = dairy.length > 0 ? dairy : (shops ?? []);
  const migrationError = specsRes.error ? "Milk Handover Certificate ka table abhi nahi. Migration 726 pehle Testing par chalao — Live se pehle backup." : null;

  return {
    branches: (branches ?? []).map((b) => ({ id: b.id, name: b.name })),
    shops: shopRows.map((s) => ({ id: s.id, name: s.name, code: s.code, branchId: s.branch_id })),
    specs: specsRes.data
      ? { minFat: Number(specsRes.data.min_fat), minLr: Number(specsRes.data.min_lr), minSnf: Number(specsRes.data.min_snf) }
      : PAPER_SPECS,
    formula: formulaFromRateRow(settingsRes.data),
    migrationError,
  };
}

export interface LoadedCertificate {
  id: string;
  branchId: string;
  shopId: string;
  date: string;
  shift: string;
  time: string;
  mccName: string;
  vehicle: string;
  driver: string;
  notes: string;
  accepted: "" | "yes" | "no";
  rejectionReason: string;
  licenseeRep: string;
  licenseeSignature: string;
  collectorSignature: string;
  lines: HandoverLineInput[];
  locked: boolean;
  priorGross: number;
  hadLines: boolean;
  received: number | null;
  lrBaseline: LrBaseline;
  destination: HandoverDestination;
  partyId: string;
  partyName: string;
  handoverReason: "" | HandoverReason;
}

function numStr(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export async function loadCertificate(id: string): Promise<LoadedCertificate | { error: string } | { missing: true }> {
  const supabase = createClient();
  const columns = "id, branch_id, shop_id, dispatch_date, shift, collection_time, mcc_name, vehicle_name, driver_name, notes, accepted, rejection_reason, licensee_rep_name, licensee_signature, collector_signature, dispatched_liters, received_liters";
  let { data, error } = await supabase
    .from("milk_dispatches")
    .select(`${columns}, lr_baseline, destination, party_id, handover_reason`)
    .eq("id", id)
    .maybeSingle();
  let lrBaseline: LrBaseline = 20;
  let destination: HandoverDestination = "company";
  let partyId = "";
  let handoverReason: "" | HandoverReason = "";
  if (error && /destination|party_id|handover_reason|lr_baseline/i.test(error.message)) {
    const again = await supabase.from("milk_dispatches").select(`${columns}, lr_baseline`).eq("id", id).maybeSingle();
    if (again.error && /lr_baseline/i.test(again.error.message)) {
      const third = await supabase.from("milk_dispatches").select(columns).eq("id", id).maybeSingle();
      data = third.data as typeof data;
      error = third.error;
    } else {
      data = again.data as typeof data;
      error = again.error;
      if (data && "lr_baseline" in data) lrBaseline = parseLrBaseline((data as { lr_baseline?: number | null }).lr_baseline);
    }
  } else if (data) {
    const row = data as { lr_baseline?: number | null; destination?: string | null; party_id?: string | null; handover_reason?: string | null };
    lrBaseline = parseLrBaseline(row.lr_baseline);
    destination = parseDestination(row.destination) ?? "company";
    partyId = row.party_id ?? "";
    const reason = parseHandoverReason(row.handover_reason);
    handoverReason = reason === "invalid" || reason == null ? "" : reason;
  }
  if (error) {
    return { error: "Milk Handover Certificate ka table abhi nahi. Migration 726 pehle Testing par chalao — Live se pehle backup." };
  }
  if (!data || !data.branch_id) return { missing: true };

  const { data: lineRows, error: lineError } = await supabase
    .from("milk_dispatch_lines")
    .select("line_no, chiller_no, milk_type, gross_volume_l, fat_percentage, lr, snf_percentage, adjusted_volume_l, temperature_c, organo")
    .eq("dispatch_id", id)
    .order("line_no");
  if (lineError) {
    return { error: "Chiller ki qatarein abhi nahi mili. Migration 726 pehle Testing par chalao." };
  }

  const lines: HandoverLineInput[] = (lineRows ?? []).map((line) => ({
    chillerNo: line.chiller_no,
    milkType: line.milk_type,
    grossL: numStr(line.gross_volume_l),
    fat: numStr(line.fat_percentage),
    lr: numStr(line.lr),
    snf: numStr(line.snf_percentage),
    adjustedL: numStr(line.adjusted_volume_l),
    temperatureC: numStr(line.temperature_c),
    organo: line.organo ?? "",
  }));

  let partyName = "";
  if (partyId) {
    const { data: party } = await supabase.from("milk_handover_parties").select("name").eq("id", partyId).maybeSingle();
    partyName = party?.name ?? "";
  }

  const time = (data.collection_time ?? "").slice(0, 5);
  return {
    id: data.id,
    branchId: data.branch_id,
    shopId: data.shop_id ?? "",
    date: data.dispatch_date,
    shift: data.shift,
    time,
    mccName: data.mcc_name ?? "",
    vehicle: data.vehicle_name ?? "",
    driver: data.driver_name ?? "",
    notes: data.notes ?? "",
    accepted: data.accepted == null ? "" : data.accepted ? "yes" : "no",
    rejectionReason: data.rejection_reason ?? "",
    licenseeRep: data.licensee_rep_name ?? "",
    licenseeSignature: data.licensee_signature ?? "",
    collectorSignature: data.collector_signature ?? "",
    lines,
    locked: data.received_liters != null,
    priorGross: Number(data.dispatched_liters),
    hadLines: lines.length > 0,
    received: data.received_liters == null ? null : Number(data.received_liters),
    lrBaseline,
    destination,
    partyId,
    partyName,
    handoverReason,
  };
}

export async function loadInternalRate(id: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.from("milk_dispatch_rates").select("rate_per_adjusted_l").eq("dispatch_id", id).maybeSingle();
  if (error || !data) return "";
  return String(data.rate_per_adjusted_l);
}

export async function loadInternalRates(ids: string[]): Promise<Map<string, { rate: number; amount: number }>> {
  const out = new Map<string, { rate: number; amount: number }>();
  if (ids.length === 0) return out;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("milk_dispatch_rates")
    .select("dispatch_id, rate_per_adjusted_l, amount")
    .in("dispatch_id", ids);
  if (error) return out;
  for (const row of data ?? []) {
    out.set(row.dispatch_id, { rate: Number(row.rate_per_adjusted_l), amount: Number(row.amount) });
  }
  return out;
}

export async function loadHandoverParties(): Promise<{ parties: HandoverPartyOption[]; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.from("milk_handover_parties").select("id, name, contact, is_active").order("name");
  if (error) {
    return { parties: [], error: "Party master abhi nahi. Migration 729 pehle Testing par chalao — Live se pehle backup." };
  }
  return {
    parties: (data ?? []).map((party) => ({
      id: party.id,
      name: party.name,
      contact: party.contact,
      active: party.is_active,
    })),
    error: null,
  };
}

export interface FlowSlip {
  id: string;
  date: string;
  shift: string;
  mccName: string;
  grossL: number;
  adjustedL: number | null;
  accepted: boolean | null;
  receivedL: number | null;
  destination: HandoverDestination;
  partyName: string | null;
  lrBaseline: LrBaseline;
}

const MIGRATION_729 = "Company, Vendor aur Party ke liye migration 729 pehle Testing par chalao — Live se pehle backup. 728 pehle honi chahiye.";

type DispatchLoose = {
  id: string;
  dispatch_date: string;
  shift: string;
  mcc_name: string | null;
  dispatched_liters: number;
  accepted: boolean | null;
  received_liters: number | null;
  branch_id: string | null;
  destination?: string | null;
  party_id?: string | null;
  handover_reason?: string | null;
  lr_baseline?: number | null;
  branches: { name?: string } | { name?: string }[] | null;
};

function branchNameOf(branches: DispatchLoose["branches"]): string {
  if (!branches) return "";
  if (Array.isArray(branches)) return branches[0]?.name ?? "";
  return branches.name ?? "";
}

export async function loadFlowSlips(input: {
  destination: HandoverDestination;
  date: string;
  branchId: string | null;
}): Promise<{ rows: FlowSlip[]; ready: boolean; error: string | null }> {
  const supabase = createClient();
  const full = "id, dispatch_date, shift, mcc_name, dispatched_liters, accepted, received_liters, branch_id, destination, party_id, lr_baseline, branches(name)";
  let query = supabase.from("milk_dispatches").select(full).order("dispatch_date", { ascending: false }).order("shift").limit(40);
  if (input.date) query = query.eq("dispatch_date", input.date);
  if (input.branchId) query = query.eq("branch_id", input.branchId);
  query = query.eq("destination", input.destination);
  let { data, error } = await query;
  let ready = true;
  if (error && /destination|party_id|lr_baseline/i.test(error.message)) {
    ready = false;
    if (input.destination !== "company") return { rows: [], ready: false, error: MIGRATION_729 };
    let again = supabase
      .from("milk_dispatches")
      .select("id, dispatch_date, shift, mcc_name, dispatched_liters, accepted, received_liters, branch_id, branches(name)")
      .order("dispatch_date", { ascending: false })
      .order("shift")
      .limit(40);
    if (input.date) again = again.eq("dispatch_date", input.date);
    if (input.branchId) again = again.eq("branch_id", input.branchId);
    const fallback = await again;
    data = fallback.data as typeof data;
    error = fallback.error;
  }
  if (error) return { rows: [], ready, error: "Milk Handover ki fehrist nahi mili. Migration 726 pehle Testing par chalao." };
  const rows = await withAdjusted((data ?? []) as unknown as DispatchLoose[], ready);
  return { rows, ready, error: null };
}

export async function loadHandoverDay(input: {
  date: string;
  branchId: string | null;
}): Promise<{
  summary: DayDestinationSummary;
  slips: FlowSlip[];
  ready: boolean;
  error: string | null;
  /** chiller = milk_chiller_totals. legacy = route raseed, jab 732 na ho. */
  intakeSource: "chiller" | "legacy";
}> {
  const supabase = createClient();
  let query = supabase
    .from("milk_dispatches")
    .select("id, dispatch_date, shift, mcc_name, dispatched_liters, accepted, received_liters, branch_id, destination, party_id, lr_baseline, branches(name)")
    .eq("dispatch_date", input.date)
    .limit(200);
  if (input.branchId) query = query.eq("branch_id", input.branchId);
  let { data, error } = await query;
  let ready = true;
  if (error && /destination|party_id|lr_baseline/i.test(error.message)) {
    ready = false;
    let again = supabase
      .from("milk_dispatches")
      .select("id, dispatch_date, shift, mcc_name, dispatched_liters, accepted, received_liters, branch_id, branches(name)")
      .eq("dispatch_date", input.date)
      .limit(200);
    if (input.branchId) again = again.eq("branch_id", input.branchId);
    const fallback = await again;
    data = fallback.data as typeof data;
    error = fallback.error;
  }
  if (error) {
    return {
      summary: dayDestinationSummary({ intake: { inL: null, incomplete: false, status: "none" }, slips: [] }),
      slips: [],
      ready,
      error: "Milk Handover ki fehrist nahi mili. Migration 726 pehle Testing par chalao.",
      intakeSource: "chiller",
    };
  }
  const slips = await withAdjusted((data ?? []) as unknown as DispatchLoose[], ready);
  const loaded = await loadIntake(input.date, input.branchId);
  const buckets: SlipBucketInput[] = slips.map((slip) => ({
    destination: slip.destination,
    grossL: slip.grossL,
    adjustedL: slip.adjustedL,
    receivedL: slip.receivedL,
  }));
  return {
    summary: dayDestinationSummary({ intake: loaded.intake, slips: buckets }),
    slips,
    ready,
    error: null,
    intakeSource: loaded.source,
  };
}

function missingChillerTotals(message: string): boolean {
  return /milk_chiller_totals|schema cache|does not exist/i.test(message);
}

async function loadIntake(date: string, branchId: string | null): Promise<{ intake: ChillerIntake; source: "chiller" | "legacy" }> {
  const supabase = createClient();
  let totals = supabase.from("milk_chiller_totals").select("gross_liters").eq("entry_date", date);
  if (branchId) totals = totals.eq("branch_id", branchId);
  const res = await totals;
  if (res.error) {
    if (missingChillerTotals(res.error.message)) {
      return { intake: await loadLegacyIntake(date, branchId), source: "legacy" };
    }
    return { intake: { inL: null, incomplete: false, status: "none" }, source: "chiller" };
  }
  return {
    intake: chillerDayIntake((res.data ?? []).map((row) => ({ grossL: Number(row.gross_liters) }))),
    source: "chiller",
  };
}

/** 732 se pehle: route ki chiller raseed + khud laya hua doodh. */
async function loadLegacyIntake(date: string, branchId: string | null): Promise<ChillerIntake> {
  const supabase = createClient();
  let routes = supabase
    .from("milk_route_collections")
    .select("route_name, chiller_received_volume")
    .eq("collection_date", date);
  let entries = supabase
    .from("milk_entries")
    .select("quantity_liters, collection_source, route_name, status")
    .eq("entry_date", date)
    .neq("status", "rejected");
  if (branchId) {
    routes = routes.eq("branch_id", branchId);
    entries = entries.eq("branch_id", branchId);
  }
  const [routeRes, entryRes] = await Promise.all([routes, entries]);
  if (routeRes.error || entryRes.error) return { inL: null, incomplete: false, status: "none" };
  return chillerIntake(
    (routeRes.data ?? []).map((row) => ({
      routeName: row.route_name,
      receivedL: row.chiller_received_volume == null ? null : Number(row.chiller_received_volume),
    })),
    (entryRes.data ?? []).map((row) => ({
      source: row.collection_source,
      routeName: row.route_name,
      liters: Number(row.quantity_liters),
    }))
  );
}

async function withAdjusted(rows: DispatchLoose[], ready = true): Promise<FlowSlip[]> {
  const supabase = createClient();
  const ids = rows.map((row) => row.id);
  const lineQuery = ids.length
    ? await supabase.from("milk_dispatch_lines").select("dispatch_id, gross_volume_l, adjusted_volume_l").in("dispatch_id", ids)
    : { data: [] as { dispatch_id: string; gross_volume_l: number; adjusted_volume_l: number | null }[] };
  const grouped = new Map<string, { grossL: number; adjustedL: number | null }[]>();
  for (const line of lineQuery.data ?? []) {
    const bucket = grouped.get(line.dispatch_id) ?? [];
    bucket.push({
      grossL: Number(line.gross_volume_l),
      adjustedL: line.adjusted_volume_l == null ? null : Number(line.adjusted_volume_l),
    });
    grouped.set(line.dispatch_id, bucket);
  }
  const partyIds = [...new Set(rows.map((row) => row.party_id).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (partyIds.length) {
    const { data: parties } = await supabase.from("milk_handover_parties").select("id, name").in("id", partyIds);
    for (const party of parties ?? []) names.set(party.id, party.name);
  }
  return rows.map((row) => {
    const destination = ready ? (parseDestination(row.destination) ?? "company") : "company";
    const lines = grouped.get(row.id);
    return {
      id: row.id,
      date: row.dispatch_date,
      shift: row.shift,
      mccName: row.mcc_name || branchNameOf(row.branches) || "—",
      grossL: Number(row.dispatched_liters),
      adjustedL: lines ? adjustedTotal(lines) : null,
      accepted: row.accepted,
      receivedL: row.received_liters == null ? null : Number(row.received_liters),
      destination,
      partyName: row.party_id ? names.get(row.party_id) ?? null : null,
      lrBaseline: ready ? parseLrBaseline(row.lr_baseline) : baselineForDestination(destination),
    };
  });
}
