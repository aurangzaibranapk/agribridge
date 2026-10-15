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
  const quantity = cleanText(body.quantity, 40);
  const unit = cleanText(body.unit, 30) || "other";
  const neededBy = cleanText(body.neededBy, 20);
  const purpose = cleanText(body.purpose, 120);
  const notes = cleanText(body.notes, 500);

  if (!productName || !quantity) {
    return NextResponse.json({ error: "Product aur quantity zaroori hai." }, { status: 400 });
  }

  const { data: farmer } = await supabase
    .from("farmers")
    .select("id, full_name, village, district")
    .eq("user_id", user.id)
    .single();
  if (!farmer) return NextResponse.json({ error: "Farmer profile nahi mili." }, { status: 404 });

  const details = {
    source: "farmer_demand_center",
    product_id: productId || null,
    product_name: productName,
    quantity,
    unit,
    needed_by: neededBy || null,
    purpose: purpose || null,
    notes: notes || null,
    farmer_name: farmer.full_name,
    village: farmer.village,
    district: farmer.district,
    payment_required_at_registration: false,
  };

  const description = `Demand: ${productName} — ${quantity} ${unit}${purpose ? ` — ${purpose}` : ""}`;

  const { data: demand, error } = await supabase
    .from("farmer_ai_requests")
    .insert({
      farmer_id: farmer.id,
      intent_type: "product_demand",
      description,
      details,
      status: "pending",
    })
    .select("id, intent_type, description, details, status, created_at, reviewed_at, expert_response")
    .single();

  if (error) {
    console.error("farmer demand insert failed", error);
    return NextResponse.json({ error: "Demand save nahi ho saki. Dobara try karein." }, { status: 500 });
  }

  return NextResponse.json({ demand });
}
