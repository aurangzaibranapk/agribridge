import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function csv(v: string | number | null | undefined) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
  const from = sp.get("from") ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.get("to") ?? new Date().toISOString().slice(0, 10);
  const supplierId = sp.get("supplier") ?? null;

  const service = createServiceClient();
  let q = service
    .from("purchases")
    .select("purchase_number, purchase_date, supplier_bill_no, total_amount, discount_amount, tax_amount, tax_label, suppliers(name)")
    .gte("purchase_date", from)
    .lte("purchase_date", to)
    .or("discount_amount.not.is.null,tax_amount.not.is.null")
    .order("purchase_date", { ascending: false });

  if (supplierId) q = q.eq("supplier_id", supplierId);

  const { data: rows } = await q;
  const purchases = (rows ?? []) as any[];

  const totalDiscount = purchases.reduce((s: number, r: any) => s + (Number(r.discount_amount) || 0), 0);
  const totalTax = purchases.reduce((s: number, r: any) => s + (Number(r.tax_amount) || 0), 0);
  const totalAmount = purchases.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);

  const header = ["Tareekh", "Bill No.", "PO Number", "Supplier", "Kul Raqam", "Trade Discount", "Advance Tax", "Tax Label", "Net Amount"];
  const dataRows = purchases.map((p: any) => {
    const disc = Number(p.discount_amount) || 0;
    const net = Number(p.total_amount) - disc;
    return [
      csv(p.purchase_date),
      csv(p.supplier_bill_no ?? ""),
      csv(p.purchase_number),
      csv(p.suppliers?.name ?? ""),
      csv(Number(p.total_amount).toFixed(2)),
      csv(disc ? disc.toFixed(2) : ""),
      csv(p.tax_amount ? Number(p.tax_amount).toFixed(2) : ""),
      csv(p.tax_label ?? ""),
      csv(net.toFixed(2)),
    ];
  });

  const totalRow = ["", "", "", "KUL TOTAL",
    csv(totalAmount.toFixed(2)),
    csv(totalDiscount.toFixed(2)),
    csv(totalTax.toFixed(2)),
    "",
    csv((totalAmount - totalDiscount).toFixed(2)),
  ];

  const allRows = [header, ...dataRows, [], totalRow];
  const csvContent = "﻿" + allRows.map((r) => r.join(",")).join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tax-discount-report-${from}-${to}.csv"`,
    },
  });
}
