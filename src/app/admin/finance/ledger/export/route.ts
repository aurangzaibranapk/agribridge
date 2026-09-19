import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accountLedger } from "@/lib/ledger/reports";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

const BUSINESS_GROUPS: { key: string; modules: string[] }[] = [
  { key: "all",         modules: [] },
  { key: "karyana",     modules: ["pos", "pos_return", "pos_shift_close"] },
  { key: "kisan_dukan", modules: ["load_bill"] },
  { key: "machinery",   modules: ["machinery_bill", "machinery_payment", "machinery_vendor_payout", "machinery_advance", "machinery_correction", "machinery_reset", "machinery_fuel", "machinery_fuel_fix"] },
  { key: "kharid",      modules: ["purchase", "supplier_payment", "supplier_payment_reversal", "purchase_correction"] },
  { key: "doodh",       modules: ["milk_collection", "milk_payment"] },
  { key: "grain",       modules: ["grain_procurement", "grain_payment", "grain_sale"] },
  { key: "udhaar",      modules: ["customer_udhaar", "customer_udhaar_wapsi", "customer_import"] },
];

function csvEscape(s: string | number | null | undefined) {
  const v = String(s ?? "");
  if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const code = sp.get("account") ?? "";
  const from = sp.get("from") ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.get("to") ?? new Date().toISOString().slice(0, 10);
  const bizKey = sp.get("business") ?? "all";

  if (!code) return new NextResponse("account required", { status: 400 });

  const selectedGroup = BUSINESS_GROUPS.find((g) => g.key === bizKey) ?? BUSINESS_GROUPS[0];
  const sourceModules = selectedGroup.modules.length > 0 ? selectedGroup.modules : null;

  const led = await accountLedger(code, from, to, null, sourceModules);
  if (led.error) return new NextResponse(led.error, { status: 500 });

  const rows = [
    ["Tareekh", "Entry No.", "Bayan", "Debit", "Credit", "Chalta Baqi"],
    [`Opening Balance (${from} se pehle)`, "", "", "", "", String(led.opening)],
    ...led.lines.map((l) => [
      csvEscape(l.entryDate),
      csvEscape(l.entryNumber),
      csvEscape(l.description + (l.memo ? " — " + l.memo : "")),
      csvEscape(l.debit || ""),
      csvEscape(l.credit || ""),
      csvEscape(l.balance),
    ]),
    ["", "", "Kul Debit", csvEscape(led.totalDebit), "", ""],
    ["", "", "Kul Credit", "", csvEscape(led.totalCredit), ""],
    ["", "", "Closing Balance", "", "", csvEscape(led.closing)],
  ];
  const csv = "﻿" + rows.map((r) => r.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-${code}-${bizKey}-${from}-${to}.csv"`,
    },
  });
}
