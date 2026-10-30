import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { requireMilkSettings } from "@/lib/dairy/rules";
import {
  PAPER_SPECS,
  type HandoverLineInput,
  type HandoverSpecs,
  type LabFormula,
} from "@/lib/milk-handover";
import type { HandoverShop } from "@/app/admin/milk-collection/handover/handover-form";

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
  formula: LabFormula | null;
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
  const settings = requireMilkSettings(settingsRes.data);
  const migrationError = specsRes.error ? "Milk Handover Certificate ka table abhi nahi. Migration 726 pehle Testing par chalao — Live se pehle backup." : null;

  return {
    branches: (branches ?? []).map((b) => ({ id: b.id, name: b.name })),
    shops: shopRows.map((s) => ({ id: s.id, name: s.name, code: s.code, branchId: s.branch_id })),
    specs: specsRes.data
      ? { minFat: Number(specsRes.data.min_fat), minLr: Number(specsRes.data.min_lr), minSnf: Number(specsRes.data.min_snf) }
      : PAPER_SPECS,
    formula: "error" in settings ? null : { snfConstant: settings.snfConstant, referenceTs: settings.referenceTs },
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
}

function numStr(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export async function loadCertificate(id: string): Promise<LoadedCertificate | { error: string } | { missing: true }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("milk_dispatches")
    .select("id, branch_id, shop_id, dispatch_date, shift, collection_time, mcc_name, vehicle_name, driver_name, notes, accepted, rejection_reason, licensee_rep_name, licensee_signature, collector_signature, dispatched_liters, received_liters")
    .eq("id", id)
    .maybeSingle();
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
  };
}
