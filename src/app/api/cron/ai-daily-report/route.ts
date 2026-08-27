import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateGeminiText } from "@/lib/ai/gemini-text-client";

export const dynamic = "force-dynamic";

const HQ_ROLES = ["super_admin", "admin", "owner"];

// cPanel Cron Job hits this URL once daily (e.g. 8am):
// curl "https://alranatraders.pk/api/cron/ai-daily-report?token=YOUR_SECRET"
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: instructionsRow } = await supabase.from("ai_report_instructions").select("instructions").limit(1).maybeSingle();
  const customInstructions = instructionsRow?.instructions?.trim() || "";

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  const branchReports: string[] = [];
  let suggestionsCreated = 0;

  for (const branch of branches ?? []) {
    // Sales in the last 30 days for this branch.
    const { data: sales } = await supabase.from("pos_sales").select("id, created_at").eq("branch_id", branch.id).gte("created_at", thirtyDaysAgoStr);
    const saleIds = (sales ?? []).map((s) => s.id);

    let saleItems: any[] = [];
    if (saleIds.length > 0) {
      const { data: items } = await supabase
        .from("pos_sale_items")
        .select("product_id, quantity, products(name)")
        .in("sale_id", saleIds);
      saleItems = items ?? [];
    }

    const salesByProduct = new Map<string, { name: string; qty: number }>();
    for (const item of saleItems) {
      const productName = Array.isArray(item.products) ? item.products[0]?.name : item.products?.name;
      const existing = salesByProduct.get(item.product_id) ?? { name: productName ?? "Product", qty: 0 };
      existing.qty += Number(item.quantity);
      salesByProduct.set(item.product_id, existing);
    }

    const totalSaleValue = (sales ?? []).length; // count of transactions, kept simple

    // Current stock for this branch's warehouse.
    const { data: warehouse } = await supabase.from("warehouses").select("id").eq("branch_id", branch.id).eq("code", "MAIN").maybeSingle();
    let stockMap = new Map<string, number>();
    if (warehouse) {
      const { data: inventoryRows } = await supabase.from("inventory").select("product_id, quantity_on_hand").eq("warehouse_id", warehouse.id);
      stockMap = new Map((inventoryRows ?? []).map((r) => [r.product_id, Number(r.quantity_on_hand)]));
    }

    // Identify fast movers running low, and slow movers sitting unsold.
    const fastMoversLow: { productId: string; name: string; suggestedQty: number; avgDaily: number; stock: number }[] = [];
    for (const [productId, data] of salesByProduct.entries()) {
      if (data.qty < 5) continue; // ignore very low-volume noise
      const avgDaily = data.qty / 30;
      const stock = stockMap.get(productId) ?? 0;
      const daysLeft = avgDaily > 0 ? stock / avgDaily : Infinity;
      if (daysLeft < 7) {
        const suggestedQty = Math.ceil(avgDaily * 30 - stock);
        if (suggestedQty > 0) {
          fastMoversLow.push({ productId, name: data.name, suggestedQty, avgDaily, stock });
        }
      }
    }

    const slowMovers: string[] = [];
    for (const [productId, stockQty] of stockMap.entries()) {
      if (stockQty > 0 && !salesByProduct.has(productId)) {
        slowMovers.push(productId);
      }
    }

    // Skip products that already have a pending or very recent (7 days)
    // suggestion, so we don't spam duplicates.
    const { data: recentSuggestions } = await supabase
      .from("ai_purchase_suggestions")
      .select("product_id, status, created_at")
      .eq("branch_id", branch.id)
      .in("status", ["pending"]);
    const skipProductIds = new Set((recentSuggestions ?? []).map((s) => s.product_id));

    for (const mover of fastMoversLow) {
      if (skipProductIds.has(mover.productId)) continue;
      await supabase.from("ai_purchase_suggestions").insert({
        branch_id: branch.id,
        product_id: mover.productId,
        suggested_qty: mover.suggestedQty,
        reason: `Pichle 30 din mein ${Math.round(mover.avgDaily * 30)} units bike, sirf ${mover.stock} bache hain - stock khatam hone wala hai.`,
        status: "pending",
      });
      suggestionsCreated += 1;
    }

    branchReports.push(
      `Branch: ${branch.name} | Transactions: ${totalSaleValue} | Fast-moving low-stock items: ${fastMoversLow.map((f) => f.name).join(", ") || "none"} | Slow-moving items count: ${slowMovers.length}`
    );

    // Branch-facing message: appreciation + what needs attention.
    let branchMessage: string | null = null;
    const branchPrompt = `Tum AgriBridge ka business assistant ho. Roman Urdu mein, dostana aur professional tone mein, is shop ke liye ek chhota daily message likho (max 4 sentences). Agar sales achi hain to shabash do aur hosla barhao. Agar koi fast-moving product ka stock khatam ho raha hai to bata do. Data: Total transactions pichle 30 din: ${totalSaleValue}. Fast-moving low-stock products: ${fastMoversLow.map((f) => f.name).join(", ") || "koi nahi"}. Slow-moving products count: ${slowMovers.length}. ${customInstructions ? "Extra instructions: " + customInstructions : ""}`;
    branchMessage = await generateGeminiText(branchPrompt);
    if (!branchMessage) {
      branchMessage = `Aaj ka summary: ${totalSaleValue} transactions huye. ${fastMoversLow.length > 0 ? `${fastMoversLow.length} products ka stock kam hai.` : "Stock theek hai."}`;
    }

    const { data: branchStaff } = await supabase.from("profiles").select("id").eq("branch_id", branch.id).eq("is_active", true);
    if ((branchStaff ?? []).length > 0) {
      await supabase.from("notifications").insert(
        (branchStaff ?? []).map((s) => ({
          recipient_user_id: s.id,
          title: "AI Daily Update",
          message: branchMessage,
          link_url: "/admin/pos/ordering",
        }))
      );
    }
  }

  // Consolidated report for Admin/Manager.
  const adminPrompt = `Tum AgriBridge ka business assistant ho. Roman Urdu mein, Admin/Manager ke liye ek concise daily summary likho (max 6 sentences), har branch ka performance overview aur jo important cheezein dhyan dene layak hain unko highlight karo. Data:\n${branchReports.join("\n")}\n${customInstructions ? "Extra instructions: " + customInstructions : ""}`;
  let adminMessage = await generateGeminiText(adminPrompt);
  if (!adminMessage) {
    adminMessage = `Daily Report:\n${branchReports.join("\n")}`;
  }

  const { data: managers } = await supabase.from("profiles").select("id").in("role", ["manager", ...HQ_ROLES]).eq("is_active", true);
  if ((managers ?? []).length > 0) {
    await supabase.from("notifications").insert(
      (managers ?? []).map((m) => ({
        recipient_user_id: m.id,
        title: "AI Daily Business Report",
        message: adminMessage,
        link_url: "/admin/ai-suggestions",
      }))
    );
  }

  return NextResponse.json({ success: true, branches: (branches ?? []).length, suggestionsCreated });
}