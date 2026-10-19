import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyProducts, demandCategoryFor, isDemandCategory, PRE_604_CATEGORIES } from "@/lib/demand/categories";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const productId = cleanText(body.productId, 80);
  const productName = cleanText(body.productName, 160);
  const quantityText = cleanText(body.quantity, 40);
  const quantity = Number(quantityText);
  const unit = cleanText(body.unit, 30) || "other";
  const neededBy = cleanText(body.neededBy, 20);
  const purpose = cleanText(body.purpose, 120);
  const notes = cleanText(body.notes, 500);
  let category: string | null = isDemandCategory(body.category) ? body.category : null;
  const area = cleanText(body.area, 120);
  const source = body.source === "munshi" ? "munshi" : "form";

  if (!productName || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Product aur valid quantity zaroori hai." }, { status: 400 });
  }

  const { data: farmer } = await supabase
    .from("farmers")
    .select("id, organization_id, branch_id")
    .eq("user_id", user.id)
    .single();
  if (!farmer) return NextResponse.json({ error: "Farmer profile nahi mili." }, { status: 404 });

  // Qism na aaye to product ki category se nikaalo (server par -- client par bharosa nahi).
  if (!category && productId) {
    const { data: prod } = await supabase.from("products").select("id, category_id").eq("id", productId).maybeSingle();
    if (prod?.category_id) {
      const { data: cats } = await (supabase as any).from("categories").select("id, name, parent_category_id, category_kind");
      const [c] = classifyProducts([prod], cats ?? []);
      if (c) category = demandCategoryFor(c.group, c.sub);
    }
  }

  const row = (cat: string | null) => ({
      organization_id: farmer.organization_id,
      branch_id: farmer.branch_id,
      farmer_id: farmer.id,
      product_id: productId || null,
      product_name: productName,
      quantity,
      unit,
      needed_by: neededBy || null,
      purpose: purpose || null,
      notes: notes || null,
      status: "pending",
      payment_required_at_registration: false,
      // Naye khane (migration 20261015233000): sirf tab bheje jate hain jab bhare hon.
      ...(cat ? { category: cat } : {}),
      ...(area ? { area } : {}),
      ...(source === "munshi" ? { source } : {}),
  });
  const SELECT = "id, product_id, product_name, quantity, unit, needed_by, purpose, notes, status, staff_note, created_at, updated_at";
  // Table abhi generated types mein nahi -- isliye any.
  let { data: demand, error } = await (supabase as any).from("farmer_product_demands").insert(row(category)).select(SELECT).single();
  // Migration 604 (karyana/other) live na ho to check constraint (23514) -- demand phir bhi save ho, qism ke baghair.
  if (error && error.code === "23514" && category && !PRE_604_CATEGORIES.includes(category)) {
    category = null;
    ({ data: demand, error } = await (supabase as any).from("farmer_product_demands").insert(row(null)).select(SELECT).single());
  }

  if (error) {
    console.error("farmer product demand insert failed", error);
    return NextResponse.json({ error: "Demand save nahi ho saki. Dobara try karein." }, { status: 500 });
  }

  return NextResponse.json({ demand: { ...demand, category } });
}
