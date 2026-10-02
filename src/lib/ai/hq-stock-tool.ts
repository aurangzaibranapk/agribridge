import { Type, type FunctionDeclaration } from "@google/genai";
import { createServiceClient } from "@/lib/supabase/service";
import type { CoachContext } from "@/lib/ai/work-coach";

export const HQ_STOCK_TOOL: FunctionDeclaration = {
  name: "get_hq_stock",
  description:
    "HQ warehouse ka stock, demand, bikri ka khaaka, aur kya mangwana chahiye — sab ek jagah. 'HQ mein kya hai', 'kya mangwana chahiye', 'kya bikta hai', 'stock ki halat', 'demand kaisi hai', 'kya khatam ho raha hai' jaise sawal par zaroor bulao.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mode: {
        type: Type.STRING,
        description: "demand = zaroorat aur reorder list | stock = abhi kitna hai | sales = bikri ka khaaka | full = sab ek sath (default)",
      },
      days: {
        type: Type.NUMBER,
        description: "Kitne din ki bikri dekhni hai: 7, 14, 30 (default), 60, 90",
      },
    },
    required: [],
  },
};

export async function executeHqStockTool(args: Record<string, any>, _ctx: CoachContext | null) {
  const mode = String(args.mode ?? "full");
  const days = Math.max(7, Math.min(90, Number(args.days ?? 30) || 30));
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const service = createServiceClient();
  const results: Record<string, any> = { days, currency: "PKR" };

  // HQ warehouse ID
  const { data: hqRow } = await (service as any)
    .from("warehouses")
    .select("id, name")
    .or("name.ilike.%HQ%,name.ilike.%Company%")
    .limit(3);

  const hqWarehouse = (hqRow ?? []).find(
    (r: any) => /hq/i.test(r.name) || /company/i.test(r.name)
  ) ?? (hqRow ?? [])[0] ?? null;

  if (!hqWarehouse) return { error: "HQ warehouse nahi mila. Pehle warehouse naam set karein." };
  results.warehouse = { id: hqWarehouse.id, name: hqWarehouse.name };

  // ── DEMAND / REORDER ──────────────────────────────────────────────────
  if (mode === "demand" || mode === "full") {
    const { data: reorder } = await (service as any)
      .from("v_reorder_suggestions")
      .select("product_id, name, pack_size, sold_30, sold_7, on_hand, daily_rate, days_cover, suggested_qty, urgency, last_supplier_name")
      .order("suggested_qty", { ascending: false })
      .limit(50);

    if (reorder) {
      const urgent = (reorder as any[]).filter((r) => r.urgency === "critical" || r.urgency === "urgent");
      const watch = (reorder as any[]).filter((r) => r.urgency === "watch");
      results.reorder = {
        urgent: urgent.slice(0, 12).map((r) => ({
          name: r.name,
          packSize: r.pack_size,
          inStock: r.on_hand,
          sold30Days: r.sold_30,
          sold7Days: r.sold_7,
          dailyRate: r.daily_rate != null ? Number(r.daily_rate).toFixed(1) : null,
          daysCover: r.days_cover != null ? Math.round(Number(r.days_cover)) : null,
          suggestOrder: r.suggested_qty,
          urgency: r.urgency,
          supplier: r.last_supplier_name ?? null,
        })),
        watch: watch.slice(0, 8).map((r) => ({
          name: r.name,
          inStock: r.on_hand,
          daysCover: r.days_cover != null ? Math.round(Number(r.days_cover)) : null,
          urgency: r.urgency,
          supplier: r.last_supplier_name ?? null,
        })),
        totalUrgentItems: urgent.length,
        totalWatchItems: watch.length,
        note: `${urgent.length} items abhi mangwane hain (urgent/critical). ${watch.length} items jald dekhne honge (watch).`,
      };
    }
  }

  // ── CURRENT STOCK (HQ warehouse specific) ────────────────────────────
  if (mode === "stock" || mode === "full") {
    const { data: inv } = await (service as any)
      .from("inventory")
      .select("quantity_on_hand, products(name, pack_size, sale_price)")
      .eq("warehouse_id", hqWarehouse.id)
      .gt("quantity_on_hand", 0)
      .order("quantity_on_hand", { ascending: false })
      .limit(25);

    if (inv) {
      const totalQty = (inv as any[]).reduce((s, r) => s + (Number(r.quantity_on_hand) || 0), 0);
      const totalValue = (inv as any[]).reduce((s, r) => s + (Number(r.quantity_on_hand) || 0) * (Number(r.products?.sale_price) || 0), 0);
      results.currentStock = {
        topItems: (inv as any[]).slice(0, 20).map((r) => ({
          name: r.products?.name ?? "—",
          packSize: r.products?.pack_size ?? "—",
          qty: r.quantity_on_hand,
          salePricePerUnit: r.products?.sale_price ?? null,
        })),
        totalProductLines: (inv as any[]).length,
        totalUnits: totalQty,
        approxStockValuePKR: Math.round(totalValue),
      };
    }
  }

  // ── SALES BY CATEGORY ─────────────────────────────────────────────────
  if (mode === "sales" || mode === "full") {
    const { data: salesRows } = await (service as any)
      .from("v_ai_sales_category")
      .select("category_name, units_sold, sales_amount, invoice_count, sale_date")
      .gte("sale_date", cutoff);

    if (salesRows) {
      const catMap = new Map<string, { units: number; sales: number; invoices: number }>();
      for (const row of salesRows as any[]) {
        const cat = String(row.category_name ?? "Uncategorized");
        const cur = catMap.get(cat) ?? { units: 0, sales: 0, invoices: 0 };
        cur.units += Number(row.units_sold ?? 0);
        cur.sales += Number(row.sales_amount ?? 0);
        cur.invoices += Number(row.invoice_count ?? 0);
        catMap.set(cat, cur);
      }
      const cats = [...catMap.entries()]
        .sort((a, b) => b[1].sales - a[1].sales)
        .slice(0, 10)
        .map(([category, v]) => ({
          category,
          unitsSold: v.units,
          salesPKR: Math.round(v.sales),
          invoices: v.invoices,
        }));
      const totalSales = cats.reduce((s, c) => s + c.salesPKR, 0);
      results.salesByCategory = {
        days,
        topCategories: cats,
        totalSalesPKR: totalSales,
        note: `${days} din ki bikri. Sabse upar wali qism sabse zyada bikti hai.`,
      };
    }
  }

  return results;
}
