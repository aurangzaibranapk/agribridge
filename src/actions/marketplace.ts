"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function placeMarketplaceOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to place an order." };

  const { data: farmer } = await supabase
    .from("farmers")
    .select("id, district, tehsil, organization_id")
    .eq("user_id", user.id)
    .single();
  if (!farmer) return { error: "Farmer profile not found." };

  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!productId) return { error: "Please select a product." };
  if (!quantity || quantity <= 0) return { error: "Quantity must be greater than zero." };

  // Find the cheapest seller (dealer stock or Al Rana's own inventory)
  // with enough quantity available - see fn_find_marketplace_offer.
  const { data: offers, error: offerError } = await supabase.rpc("fn_find_marketplace_offer", {
    p_product_id: productId,
    p_quantity: quantity,
    p_organization_id: farmer.organization_id,
  });

  if (offerError) return { error: offerError.message };
  if (!offers || offers.length === 0) {
    return { error: "No seller currently has enough stock for this quantity." };
  }

  const offer = offers[0];
  const subtotal = quantity * Number(offer.unit_price);
  const orderNumber = `MKT-${Date.now()}`;

  const { data: order, error: orderError } = await supabase
    .from("bridge_orders")
    .insert({
      order_number: orderNumber,
      farmer_id: farmer.id,
      assigned_dealer_id: offer.dealer_id,
      status: "assigned",
      source: "marketplace",
      district: farmer.district ?? "Unknown",
      tehsil: farmer.tehsil,
      subtotal,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { error: orderError?.message ?? "Failed to place order." };
  }

  const { error: itemError } = await supabase.from("bridge_order_items").insert({
    order_id: order.id,
    product_id: productId,
    quantity,
    unit_price: offer.unit_price,
    line_total: subtotal,
  });

  if (itemError) return { error: `Failed to save order line: ${itemError.message}` };

  revalidatePath("/portal/marketplace");
  return { success: true };
}