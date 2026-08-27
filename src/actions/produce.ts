"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------------
// FARMER: create/manage listings
// ---------------------------------------------------------------------
export async function createProduceListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) return { error: "Farmer profile not found." };

  const cropName = String(formData.get("crop_name") ?? "").trim();
  const quantity = Number(formData.get("quantity_available") ?? 0);
  const unit = String(formData.get("unit") ?? "kg");
  const price = Number(formData.get("asking_price_per_unit") ?? 0);
  const quality = (formData.get("quality_grade") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!cropName) return { error: "Crop name is required." };
  if (!quantity || quantity <= 0) return { error: "Quantity must be greater than zero." };
  if (!price || price <= 0) return { error: "Asking price must be greater than zero." };

  const { error } = await supabase.from("produce_listings").insert({
    farmer_id: farmer.id,
    crop_name: cropName,
    quantity_available: quantity,
    unit,
    asking_price_per_unit: price,
    quality_grade: quality,
    notes,
  });

  if (error) return { error: error.message };

  revalidatePath("/portal/sell-produce");
  return { success: true };
}

export async function cancelProduceListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const listingId = String(formData.get("listing_id") ?? "");
  if (!listingId) return { error: "Missing listing id." };

  const { error } = await supabase.from("produce_listings").update({ status: "cancelled" }).eq("id", listingId);
  if (error) return { error: error.message };

  revalidatePath("/portal/sell-produce");
  return { success: true };
}

// ---------------------------------------------------------------------
// BUYER: place orders
// ---------------------------------------------------------------------
export async function placeProduceOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { data: buyer } = await supabase.from("buyers").select("id").eq("user_id", user.id).single();
  if (!buyer) return { error: "Buyer profile not found." };

  const listingId = String(formData.get("listing_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!listingId) return { error: "Please select a listing." };
  if (!quantity || quantity <= 0) return { error: "Quantity must be greater than zero." };

  const { data: listing } = await supabase
    .from("produce_listings")
    .select("id, farmer_id, quantity_available, asking_price_per_unit, status")
    .eq("id", listingId)
    .single();

  if (!listing || listing.status !== "active") return { error: "This listing is no longer available." };
  if (quantity > Number(listing.quantity_available)) return { error: "Requested quantity exceeds what's available." };

  const orderNumber = `SELL-${Date.now()}`;

  const { error } = await supabase.from("produce_orders").insert({
    order_number: orderNumber,
    listing_id: listingId,
    farmer_id: listing.farmer_id,
    buyer_id: buyer.id,
    quantity,
    unit_price: listing.asking_price_per_unit,
    subtotal: 0, // overwritten by fn_apply_produce_order_commission trigger
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/buyer/marketplace");
  return { success: true };
}

// ---------------------------------------------------------------------
// FARMER: respond to order
// ---------------------------------------------------------------------
export async function farmerRespondToProduceOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  const response = String(formData.get("response") ?? "");

  if (!orderId) return { error: "Missing order id." };
  if (response !== "accept" && response !== "reject") return { error: "Invalid response." };

  const { error } = await supabase
    .from("produce_orders")
    .update({ status: response === "accept" ? "farmer_accepted" : "farmer_rejected" })
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath("/portal/sell-produce");
  return { success: true };
}

// ---------------------------------------------------------------------
// ADMIN: verify + mark delivered
// ---------------------------------------------------------------------
export async function adminVerifyProduceOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const { error } = await supabase.from("produce_orders").update({ status: "staff_verified" }).eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/admin/produce-orders");
  return { success: true };
}

export async function adminMarkProduceDelivered(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const { error } = await supabase.from("produce_orders").update({ status: "delivered" }).eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/admin/produce-orders");
  return { success: true };
}