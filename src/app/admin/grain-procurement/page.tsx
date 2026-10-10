import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { GrainClient } from "@/app/admin/grain-procurement/grain-client";
import { GrainSummaryCards } from "@/app/admin/grain-procurement/grain-summary-cards";
import { summarizeGrainLedger, GRAIN_ONLY_ACCOUNTS, type GrainLedgerLine, type GrainSummary } from "@/lib/grain/ledger-summary";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function loadGrainSummary(supabase: any, from: string, to: string): Promise<{ summary: GrainSummary | null; error: string | null }> {
  try {
    const [mods, accs] = await Promise.all([
      supabase.from("journal_entries").select("id").ilike("source_module", "grain%").lte("entry_date", to).limit(10000),
      supabase.from("journal_lines").select("entry_id").in("account_code", [...GRAIN_ONLY_ACCOUNTS]).limit(10000),
    ]);
    if (mods.error) throw mods.error;
    if (accs.error) throw accs.error;
    const ids = Array.from(new Set([...(mods.data ?? []).map((r: any) => r.id), ...(accs.data ?? []).map((r: any) => r.entry_id)]));
    const lines: GrainLedgerLine[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase
        .from("journal_lines")
        .select("entry_id, account_code, debit, credit, journal_entries!inner(entry_date, source_module)")
        .in("entry_id", ids.slice(i, i + 200));
      if (error) throw error;
      for (const r of data ?? []) {
        const je = Array.isArray(r.journal_entries) ? r.journal_entries[0] : r.journal_entries;
        lines.push({ entry_id: r.entry_id, account_code: r.account_code, debit: r.debit, credit: r.credit, entry_date: je?.entry_date, source_module: je?.source_module ?? null });
      }
    }
    return { summary: summarizeGrainLedger(lines, { from: from || null, to }), error: null };
  } catch (e: any) {
    return { summary: null, error: e?.message ?? String(e) };
  }
}

export const dynamic = "force-dynamic";

export default async function AdminGrainProcurementPage({ searchParams }: { searchParams?: { from?: string; to?: string } }) {
  const supabase = createClient();
  const summaryFrom = ISO_DATE.test(searchParams?.from ?? "") ? String(searchParams?.from) : "";
  const summaryTo = ISO_DATE.test(searchParams?.to ?? "") ? String(searchParams?.to) : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  const grainSummary = await loadGrainSummary(supabase, summaryFrom, summaryTo);
  const lang = getLanguageFromCookies("rm");
  const { data: { user } } = await supabase.auth.getUser();
  const [
    { data: farmers },
    { data: parties },
    { data: warehouses },
    { data: cutPresets },
    { data: financeAccounts },
    { data: buyers },
    { data: rawEntries },
    { data: rawPayments },
    { data: grainRules },
    { data: profile },
    { data: rawPending },
  ] = await Promise.all([
    supabase.from("farmers").select("id, full_name, farmer_code, phone_number, cnic").eq("is_deleted", false).order("full_name"),
    supabase.from("grain_parties").select("id, party_name, contact_person, phone").eq("is_active", true).order("party_name"),
    supabase.from("warehouses").select("id, name").eq("is_active", true).order("name"),
    supabase.from("grain_cut_presets").select("id, grain_type, label, cut_percentage").eq("is_active", true).order("grain_type"),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
    supabase.from("buyers").select("id, business_name").eq("is_active", true).order("business_name"),
    supabase
      .from("grain_procurement_entries")
      .select("id, entry_date, grain_type, gross_weight_kg, cut_percentage, cut_kg, weight_kg, moisture_percentage, quality_grade, rate_per_kg, total_amount, chungi_amount, farmer_id, party_id, pending_entry_id, farmers(full_name), grain_parties(party_name)")
      .is("reclassified_as_sale_id", null)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("grain_procurement_payments")
      .select("id, amount, payment_method, notes, created_at, farmer_id, party_id, reclassified_as_sale_payment_id, farmers(full_name), grain_parties(party_name)")
      .is("reclassified_as_sale_payment_id", null)
      .order("created_at", { ascending: false })
      .limit(200),
    (supabase as any).from("grain_pack_rules").select("grain_type,is_bag_based,bag_weight_kg,default_cut_kg,default_cut_grams,default_chungi_kg").order("grain_type"),
    supabase.from("profiles").select("role,is_active").eq("id", user?.id ?? "").maybeSingle(),
    // Pending (Admin approval) -- migration 518. Ye hisaab mein shamil NAHI.
    (supabase as any)
      .from("grain_pending_entries")
      .select("id, status, entry_date, grain_type, gross_weight_kg, net_weight_kg, payable_amount, reject_reason, approved_entry_id, farmers(full_name), grain_parties(party_name)")
      .in("status", ["pending", "approving", "rejected"])
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const { data: grainProducts, error: grainProductError } = await supabase.from("grain_type_products").select("grain_type, product_id");
  if (grainProductError) throw new Error(grainProductError.message);
  const productIds = (grainProducts ?? []).map(row => row.product_id);
  const stockByWarehouseAndType: Record<string, Record<string, number>> = {};
  if (productIds.length) {
    const { data: stocks, error } = await supabase.from("inventory").select("warehouse_id, product_id, quantity_on_hand").in("product_id", productIds);
    if (error) throw new Error(error.message);
    for (const row of stocks ?? []) {
      const type = grainProducts?.find(product => product.product_id === row.product_id)?.grain_type;
      if (!type) continue;
      stockByWarehouseAndType[row.warehouse_id] ??= {};
      stockByWarehouseAndType[row.warehouse_id][type] = (stockByWarehouseAndType[row.warehouse_id][type] ?? 0) + Number(row.quantity_on_hand);
    }
  }

  const entries = (rawEntries ?? []).map((e: any) => {
    const farmer = Array.isArray(e.farmers) ? e.farmers[0] : e.farmers;
    const party = Array.isArray(e.grain_parties) ? e.grain_parties[0] : e.grain_parties;
    return {
      id: e.id,
      entry_date: e.entry_date,
      grain_type: e.grain_type,
      gross_weight_kg: Number(e.gross_weight_kg ?? e.weight_kg),
      cut_percentage: Number(e.cut_percentage ?? 0),
      cut_kg: Number(e.cut_kg ?? 0),
      weight_kg: Number(e.weight_kg),
      moisture_percentage: e.moisture_percentage,
      quality_grade: e.quality_grade,
      rate_per_kg: Number(e.rate_per_kg),
      total_amount: Number(e.total_amount),
      payable_amount: Number(e.total_amount) - Number(e.chungi_amount ?? 0),
      seller_id: e.farmer_id ?? e.party_id,
      seller_type: e.farmer_id ? "farmer" : "party",
      seller_name: farmer?.full_name ?? party?.party_name ?? "-",
      pending_entry_id: e.pending_entry_id ?? null,
    };
  });

  const pendingRows = (rawPending ?? []).map((r: any) => {
    const farmer = Array.isArray(r.farmers) ? r.farmers[0] : r.farmers;
    const party = Array.isArray(r.grain_parties) ? r.grain_parties[0] : r.grain_parties;
    return {
      id: r.id as string,
      status: r.status,
      entry_date: r.entry_date,
      grain_type: r.grain_type,
      seller_name: farmer?.full_name ?? party?.party_name ?? "-",
      gross_weight_kg: Number(r.gross_weight_kg ?? 0),
      net_weight_kg: Number(r.net_weight_kg ?? 0),
      payable_amount: Number(r.payable_amount ?? 0),
      reject_reason: r.reject_reason ?? null,
      approved_entry_id: r.approved_entry_id ?? null,
    };
  });
  const canApprove = Boolean(profile?.is_active && ["owner", "super_admin", "admin"].includes(profile.role ?? ""));

  const payments = (rawPayments ?? []).map((p: any) => {
    const farmer = Array.isArray(p.farmers) ? p.farmers[0] : p.farmers;
    const party = Array.isArray(p.grain_parties) ? p.grain_parties[0] : p.grain_parties;
    return {
      id: p.id,
      amount: Number(p.amount),
      payment_method: p.payment_method,
      notes: p.notes,
      created_at: p.created_at,
      seller_id: p.farmer_id ?? p.party_id,
      seller_type: p.farmer_id ? "farmer" : "party",
      seller_name: farmer?.full_name ?? party?.party_name ?? "-",
    };
  });

  const balanceMap: Record<string, { seller_id: string; seller_type: string; seller_name: string; total_supplied: number; total_paid: number; entry_count: number }> = {};
  entries.forEach((e) => {
    const key = `${e.seller_type}-${e.seller_id}`;
    if (!balanceMap[key]) balanceMap[key] = { seller_id: e.seller_id, seller_type: e.seller_type, seller_name: e.seller_name, total_supplied: 0, total_paid: 0, entry_count: 0 };
    balanceMap[key].total_supplied += e.payable_amount;
    balanceMap[key].entry_count += 1;
  });
  payments.forEach((p) => {
    const key = `${p.seller_type}-${p.seller_id}`;
    if (!balanceMap[key]) balanceMap[key] = { seller_id: p.seller_id, seller_type: p.seller_type, seller_name: p.seller_name, total_supplied: 0, total_paid: 0, entry_count: 0 };
    balanceMap[key].total_paid += p.amount;
  });
  const balances = Object.values(balanceMap)
    .map((b) => ({ ...b, balance_due: b.total_supplied - b.total_paid }))
    .sort((a, b) => b.balance_due - a.balance_due);

  const totalPurchasedKg = entries.reduce((s, e) => s + e.weight_kg, 0);
  const totalSpent = entries.reduce((s, e) => s + e.payable_amount, 0);
  const totalPaidOut = payments.reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = totalSpent - totalPaidOut;

  const byGrainType = ["wheat", "rice", "maize"].map((type) => {
    const typeEntries = entries.filter((e) => e.grain_type === type);
    return {
      grain_type: type,
      totalKg: typeEntries.reduce((s, e) => s + e.weight_kg, 0),
      totalValue: typeEntries.reduce((s, e) => s + e.total_amount, 0),
      entryCount: typeEntries.length,
    };
  });

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <PageHeader title={t("gr_title", lang)} description={t("gr_subtitle", lang)} />

      <GrainSummaryCards summary={grainSummary.summary} from={summaryFrom} to={summaryTo} error={grainSummary.error} />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_total_bought_kg", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{totalPurchasedKg.toLocaleString()} kg</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_total_expense", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalSpent.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">{t("at_total_paid", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {totalPaidOut.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">{t("at_payable", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">Rs {totalOutstanding.toLocaleString()}</p>
        </Card>
      </div>

      <GrainClient
        farmers={(farmers ?? []).map((farmer: any) => ({ ...farmer, full_name: farmer.full_name ?? "" }))}
        parties={parties ?? []}
        warehouses={warehouses ?? []}
        cutPresets={cutPresets ?? []}
        grainRules={(grainRules ?? []).map((rule: any) => ({
          grain_type: String(rule.grain_type), is_bag_based: Boolean(rule.is_bag_based),
          bag_weight_kg: rule.bag_weight_kg == null ? null : Number(rule.bag_weight_kg),
          default_cut_kg: Number(rule.default_cut_kg ?? 0), default_cut_grams: Number(rule.default_cut_grams ?? 0),
          default_chungi_kg: Number(rule.default_chungi_kg ?? 0),
        }))}
        canManageRules={Boolean(profile?.is_active && ["owner","super_admin","admin"].includes(profile.role ?? ""))}
        financeAccounts={financeAccounts ?? []}
        buyers={buyers ?? []}
        stockByWarehouseAndType={stockByWarehouseAndType}
        entries={entries}
        payments={payments}
        balances={balances}
        byGrainType={byGrainType}
        pendingRows={pendingRows}
        canApprove={canApprove}
      />
    </div>
  );
}
