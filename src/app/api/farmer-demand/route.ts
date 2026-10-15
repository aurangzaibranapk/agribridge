import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  if (!productName || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Product aur valid quantity zaroori hai." }, { status: 400 });
  }

  const { data: farmer } = await supabase
    .from("farmers")
    .select("id, organization_id, branch_id")
    .eq("user_id", user.id)
    .single();
  if (!farmer) return NextResponse.json({ error: "Farmer profile nahi mili." }, { status: 404 });

  // Table abhi generated types mein nahi (migration live nahi) -- isliye any.
  const { data: demand, error } = await (supabase as any)
    .from("farmer_product_demands")
    .insert({
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
    })
    .select("id, product_id, product_name, quantity, unit, needed_by, purpose, notes, status, staff_note, created_at, updated_at")
    .single();

  if (error) {
    console.error("farmer product demand insert failed", error);
    return NextResponse.json({ error: "Demand save nahi ho saki. Dobara try karein." }, { status: 500 });
  }

  return NextResponse.json({ demand });
}
