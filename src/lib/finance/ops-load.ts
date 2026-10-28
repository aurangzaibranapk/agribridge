import { createClient } from "@/lib/supabase/server";
import { canDo } from "@/lib/access/guard";
import {
  inKarachiMonth,
  karachiMonth,
  opsReview,
  opsStatusLabel,
  sortQueue,
  sourceTitle,
  spendCard,
  type OpsDeskModel,
  type OpsMovement,
  type OpsQueueItem,
  type OpsSource,
  type SpendPart,
} from "@/lib/finance/ops-desk";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rel(v: unknown): Record<string, unknown> | null {
  const row = Array.isArray(v) ? v[0] : v;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

interface Raw {
  id: string;
  source: OpsSource;
  date: string;
  amount: number | null;
  status: string;
  createdBy: string | null;
  makers: Array<string | null>;
  asset: string | null;
  anomaly: boolean;
  href: string;
  countsAsSpend: boolean;
}

/**
 * Maujooda fuel, generator, marammat aur machine diesel.
 * Jo query fail ho us ka raqam null rehta hai, sifar nahi.
 */
export async function loadOpsDesk(now = new Date()): Promise<OpsDeskModel> {
  const month = karachiMonth(now);
  const sb = createClient() as any;
  const from = `${month.prefix}-01`;
  const notes: string[] = [];

  const { data: auth } = await sb.auth.getUser();
  const actorId = (auth?.user?.id as string | undefined) ?? "";
  let role = "";
  if (actorId) {
    const { data: me } = await sb.from("profiles").select("role").eq("id", actorId).maybeSingle();
    role = (me?.role as string | undefined) ?? "";
  }

  const [canFuel, canGen, canVerifyClaim, canApproveClaim, fuelQ, genQ, maintQ, claimQ, machineMonthQ, runQ] = await Promise.all([
    canDo("fuel", "approve"),
    canDo("generator", "approve"),
    canDo("machinery-rental.work-claims", "verify"),
    canDo("machinery-rental.work-claims", "approve"),
    sb
      .from("fuel_logs")
      .select("id, log_date, fuel_cost, approval_status, created_by, is_anomaly, vehicles(vehicle_name)")
      .or(`approval_status.eq.pending,log_date.gte.${from}`)
      .order("log_date", { ascending: false })
      .limit(400),
    sb
      .from("generator_logs")
      .select("id, log_date, diesel_cost, approval_status, created_by, is_anomaly, branches(name)")
      .or(`approval_status.eq.pending,log_date.gte.${from}`)
      .order("log_date", { ascending: false })
      .limit(400),
    sb
      .from("maintenance_logs")
      .select("id, service_date, cost, status, created_by, branch_verified_by, maintenance_type, vehicles(vehicle_name)")
      .or(`status.in.(pending,branch_verified),service_date.gte.${from}`)
      .order("service_date", { ascending: false })
      .limit(400),
    sb
      .from("machinery_fuel_logs")
      .select("id, log_date, amount, litres, paid_by, verification_status, created_by, submitted_by, manager_confirmed_by, machinery_bookings(booking_number)")
      .in("verification_status", ["claimed", "manager_confirmed"])
      .order("log_date", { ascending: false })
      .limit(200),
    sb
      .from("machinery_fuel_logs")
      .select("id, log_date, amount, paid_by, verification_status, created_by, machinery_bookings(booking_number)")
      .eq("verification_status", "verified")
      .eq("paid_by", "company")
      .gte("log_date", from)
      .order("log_date", { ascending: false })
      .limit(200),
    sb
      .from("payroll_runs")
      .select("id, status")
      .eq("pay_year", month.year)
      .eq("pay_month", month.month)
      .is("branch_id", null)
      .neq("status", "cancelled")
      .maybeSingle(),
  ]);

  const raw: Raw[] = [];

  const fuelRead = !fuelQ.error;
  if (!fuelRead) notes.push("Route ka tel parha nahi gaya.");
  for (const row of fuelRead ? fuelQ.data ?? [] : []) {
    const vehicle = text(rel(row.vehicles)?.vehicle_name);
    const status = String(row.approval_status ?? "");
    const date = String(row.log_date ?? "");
    raw.push({
      id: String(row.id),
      source: "route_fuel",
      date,
      amount: num(row.fuel_cost),
      status,
      createdBy: text(row.created_by),
      makers: [text(row.created_by)],
      asset: vehicle,
      anomaly: Boolean(row.is_anomaly),
      href: "/admin/milk-collection/fuel",
      countsAsSpend: status === "approved" && inKarachiMonth(date, month.prefix),
    });
  }

  const genRead = !genQ.error;
  if (!genRead) notes.push("Generator diesel parha nahi gaya.");
  for (const row of genRead ? genQ.data ?? [] : []) {
    const branch = text(rel(row.branches)?.name);
    const status = String(row.approval_status ?? "");
    const date = String(row.log_date ?? "");
    raw.push({
      id: String(row.id),
      source: "generator",
      date,
      amount: num(row.diesel_cost),
      status,
      createdBy: text(row.created_by),
      makers: [text(row.created_by)],
      asset: branch ? `Generator · ${branch}` : "Generator",
      anomaly: Boolean(row.is_anomaly),
      href: "/admin/milk-collection/generator",
      countsAsSpend: status === "approved" && inKarachiMonth(date, month.prefix),
    });
  }

  const maintRead = !maintQ.error;
  if (!maintRead) notes.push("Marammat parhi nahi gayi.");
  for (const row of maintRead ? maintQ.data ?? [] : []) {
    const vehicle = text(rel(row.vehicles)?.vehicle_name);
    const kind = text(row.maintenance_type);
    const status = String(row.status ?? "");
    const date = String(row.service_date ?? "");
    raw.push({
      id: String(row.id),
      source: "maintenance",
      date,
      amount: num(row.cost),
      status,
      createdBy: text(row.created_by),
      makers: [text(row.created_by), text(row.branch_verified_by)],
      asset: vehicle,
      anomaly: false,
      href: "/admin/milk-collection/maintenance",
      countsAsSpend: status === "approved" && inKarachiMonth(date, month.prefix),
    });
    if (kind && raw[raw.length - 1].asset) raw[raw.length - 1].asset = `${raw[raw.length - 1].asset} · ${kind}`;
    else if (kind) raw[raw.length - 1].asset = kind;
  }

  const claimRead = !claimQ.error;
  const machineMonthRead = !machineMonthQ.error;
  const machineRead = claimRead && machineMonthRead;
  if (!machineRead) notes.push("Machine diesel parha nahi gaya.");
  const seenMachine = new Set<string>();
  for (const row of [...(claimRead ? claimQ.data ?? [] : []), ...(machineMonthRead ? machineMonthQ.data ?? [] : [])]) {
    const id = String(row.id);
    if (seenMachine.has(id)) continue;
    seenMachine.add(id);
    const booking = text(rel(row.machinery_bookings)?.booking_number);
    const status = String(row.verification_status ?? "");
    const date = String(row.log_date ?? "");
    const company = row.paid_by === "company";
    raw.push({
      id,
      source: "machine_diesel",
      date,
      amount: num(row.amount),
      status,
      createdBy: text(row.created_by),
      makers: [text(row.created_by), text(row.submitted_by), text(row.manager_confirmed_by)],
      asset: booking ? `Booking ${booking}` : "Machine",
      anomaly: false,
      href: "/admin/machinery-rental/work-claims",
      countsAsSpend: status === "verified" && company && inKarachiMonth(date, month.prefix),
    });
  }

  const ids = raw.map((r) => r.createdBy).filter((id): id is string => !!id);
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: people, error: nameError } = await sb.from("profiles").select("id, full_name").in("id", [...new Set(ids)]);
    if (nameError) notes.push("Naam parhe nahi gaye.");
    else for (const p of people ?? []) if (p.full_name) nameById.set(String(p.id), String(p.full_name));
  }

  const queue: OpsQueueItem[] = [];
  const movements: OpsMovement[] = [];
  for (const row of raw) {
    const open =
      (row.source === "route_fuel" && row.status === "pending") ||
      (row.source === "generator" && row.status === "pending") ||
      (row.source === "maintenance" && (row.status === "pending" || row.status === "branch_verified")) ||
      (row.source === "machine_diesel" && (row.status === "claimed" || row.status === "manager_confirmed"));
    const who = row.createdBy ? nameById.get(row.createdBy) ?? null : null;
    if (open) {
      queue.push({
        id: row.id,
        source: row.source,
        title: sourceTitle(row.source),
        who,
        asset: row.asset,
        amount: row.amount,
        date: row.date,
        statusLabel: opsStatusLabel(row.status),
        anomaly: row.anomaly,
        href: row.href,
        review: opsReview({
          source: row.source,
          status: row.status,
          role,
          actorId,
          makers: row.makers,
          canFuel,
          canGen,
          canVerifyClaim,
          canApproveClaim,
        }),
      });
    } else if (inKarachiMonth(row.date, month.prefix)) {
      movements.push({
        id: `${row.source}-${row.id}`,
        title: sourceTitle(row.source),
        detail: [who, row.asset].filter(Boolean).join(" · ") || "—",
        amount: row.amount,
        date: row.date,
        statusLabel: opsStatusLabel(row.status),
      });
    }
  }

  function part(source: OpsSource, read: boolean): SpendPart {
    const rows = raw.filter((r) => r.source === source);
    return {
      read,
      amounts: rows.filter((r) => r.countsAsSpend && r.amount != null).map((r) => r.amount as number),
      pending: rows.filter((r) => queue.some((q) => q.id === r.id && q.source === source)).length,
    };
  }

  const fuelPart = part("route_fuel", fuelRead);
  const genPart = part("generator", genRead);
  const maintPart = part("maintenance", maintRead);
  const machinePart = part("machine_diesel", machineRead);
  const fuelSpend = spendCard([fuelPart]);
  const dieselSpend = spendCard([genPart, machinePart]);
  const maintSpend = spendCard([maintPart]);

  const line = (label: string, p: SpendPart) => ({
    label,
    amount: p.read ? p.amounts.reduce((s, n) => s + n, 0) : null,
  });

  let payroll: OpsDeskModel["payroll"] = {
    read: false,
    status: null,
    staff: null,
    payable: null,
    href: `/admin/hr/payroll?m=${month.prefix}&view=cards`,
  };
  if (runQ.error) notes.push("Payroll parha nahi gaya.");
  else if (!runQ.data) {
    payroll = { read: true, status: "none", staff: 0, payable: 0, href: payroll.href };
  } else {
    const { data: lines, error: lineError } = await sb.from("payroll_lines").select("net").eq("run_id", runQ.data.id);
    if (lineError) notes.push("Payroll ki lines parhi nahi gayin.");
    else {
      const nets = (lines ?? []).map((l: { net: unknown }) => num(l.net));
      const payable = nets.some((n: number | null) => n == null) ? null : nets.reduce((s: number, n: number | null) => s + (n ?? 0), 0);
      payroll = {
        read: true,
        status: String(runQ.data.status),
        staff: (lines ?? []).length,
        payable,
        href: payroll.href,
      };
    }
  }

  const unpriced = raw.filter((r) => r.countsAsSpend && r.amount == null).length;
  if (unpriced) notes.push(`${unpriced} manzoor qatarein bina raqam — wo is jama mein nahi.`);

  movements.sort((a, b) => b.date.localeCompare(a.date));

  return {
    monthLabel: month.label,
    monthPrefix: month.prefix,
    cards: [
      {
        key: "route",
        title: "Route ka tel",
        titleUr: "روٹ کا تیل",
        blurb: "Motorcycle fuel logs — manzoor shuda is mahine",
        amount: fuelSpend.amount,
        pending: fuelSpend.pending,
        lines: [line("Manzoor", fuelPart)],
        href: "/admin/milk-collection/fuel",
      },
      {
        key: "diesel",
        title: "Diesel",
        titleUr: "ڈیزل",
        blurb: "Generator + company machine diesel",
        amount: dieselSpend.amount,
        pending: dieselSpend.pending,
        lines: [line("Generator", genPart), line("Machine (company)", machinePart)],
        href: "/admin/milk-collection/generator",
      },
      {
        key: "maint",
        title: "Gaari ki marammat",
        titleUr: "گاڑی کی مرمت",
        blurb: "Manzoor shuda maintenance is mahine",
        amount: maintSpend.amount,
        pending: maintSpend.pending,
        lines: [line("Manzoor", maintPart)],
        href: "/admin/milk-collection/maintenance",
      },
    ],
    queue: sortQueue(queue).slice(0, 40),
    movements: movements.slice(0, 12),
    payroll,
    notes,
  };
}
