import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/api-auth";

export async function GET() {
  // AI ke action requests staff ka andaruni kaam hai. Middleware /api ko nahi bachata,
  // is liye rok yahan lagani parti hai.
  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createClient();

  const [{ data: requests, error }, { data: suppliers }, { data: branches }] = await Promise.all([
    supabase
      .from("bridge_ai_action_requests")
      .select(
        "id, created_at, action_type, description, details, status, review_notes, product_id, suggested_quantity, created_purchase_id, products(name, purchase_price)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const normalized = (requests ?? []).map((r: any) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    return {
      id: r.id,
      created_at: r.created_at,
      action_type: r.action_type,
      description: r.description,
      details: r.details,
      status: r.status,
      review_notes: r.review_notes,
      product_id: r.product_id,
      product_name: product?.name ?? null,
      product_purchase_price: product?.purchase_price ?? null,
      suggested_quantity: r.suggested_quantity,
      created_purchase_id: r.created_purchase_id,
    };
  });

  return NextResponse.json({
    requests: normalized,
    suppliers: suppliers ?? [],
    branches: branches ?? [],
  });
}