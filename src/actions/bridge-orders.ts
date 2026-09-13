"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
  orderId?: string;
}

/**
 * Staff-only kaam (verify/deliver/payment). Farmer/dealer wale raaste
 * (place/respond/dispatch) RLS se hi mehfooz hain (`dealer_update_own_
 * assigned_orders`, `farmer_own_bridge_orders`) -- yahan koi naya check
 * nahi.
 *
 * Ye teen kaam ab tak koi bhi login-shuda staff kar sakta tha (RLS
 * `tenant_scoped_access` naun departments tak khula hai) -- HR, warehouse,
 * milk_collection, procurement ka is marketplace se koi taalluq nahi.
 */
const MARKETPLACE_STAFF = ["owner", "super_admin", "admin", "manager", "finance", "sales_staff"];

async function marketplaceStaff(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai." };
  if (!MARKETPLACE_STAFF.includes(profile.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };
  return { userId: user.id };
}

type OrderItemInput = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

async function findDealerForArea(
  supabase: ReturnType<typeof createClient>,
  district: string,
  tehsil: string | null
) {
  if (tehsil) {
    const { data: tehsilMatches } = await supabase
      .from("dealer_service_areas")
      .select("dealer_id, dealers(id, current_payable, is_active, verification_status)")
      .eq("district", district)
      .eq("tehsil", tehsil);

    const active = (tehsilMatches ?? [])
      .map((m: any) => (Array.isArray(m.dealers) ? m.dealers[0] : m.dealers))
      .filter((d: any) => d && d.is_active && d.verification_status === "verified");

    if (active.length > 0) {
      active.sort((a: any, b: any) => a.current_payable - b.current_payable);
      return active[0].id as string;
    }
  }

  const { data: districtMatches } = await supabase
    .from("dealer_service_areas")
    .select("dealer_id, dealers(id, current_payable, is_active, verification_status)")
    .eq("district", district);

  const active = (districtMatches ?? [])
    .map((m: any) => (Array.isArray(m.dealers) ? m.dealers[0] : m.dealers))
    .filter((d: any) => d && d.is_active && d.verification_status === "verified");

  if (active.length === 0) return null;
  active.sort((a: any, b: any) => a.current_payable - b.current_payable);
  return active[0].id as string;
}

export async function placeBridgeOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to place an order." };

  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) return { error: "Farmer profile not found." };

  const district = String(formData.get("district") ?? "").trim();
  const tehsil = (formData.get("tehsil") as string) || null;

  if (!district) return { error: "District is required so we can route your order." };

  let items: OrderItemInput[];
  try {
    items = JSON.parse(String(formData.get("items_json") ?? "[]"));
  } catch {
    return { error: "Invalid order data." };
  }

  if (!items || items.length === 0) return { error: "Add at least one product to your order." };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const orderNumber = `BRG-${Date.now()}`;

  const dealerId = await findDealerForArea(supabase, district, tehsil);

  const { data: order, error: orderError } = await supabase
    .from("bridge_orders")
    .insert({
      order_number: orderNumber,
      farmer_id: farmer.id,
      assigned_dealer_id: dealerId,
      status: dealerId ? "assigned" : "placed",
      district,
      tehsil,
      subtotal,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { error: orderError?.message ?? "Failed to place order." };
  }

  for (const item of items) {
    const { error: itemError } = await supabase.from("bridge_order_items").insert({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.quantity * item.unit_price,
    });
    if (itemError) return { error: `Failed to save an order line: ${itemError.message}` };
  }

  revalidatePath("/portal/orders");
  return { success: true, orderId: order.id };
}

export async function dealerRespondToOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  const response = String(formData.get("response") ?? "");

  if (!orderId) return { error: "Missing order id." };
  if (response !== "accept" && response !== "reject") return { error: "Invalid response." };

  const { error } = await supabase
    .from("bridge_orders")
    .update({ status: response === "accept" ? "dealer_accepted" : "dealer_rejected" })
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath("/dealer/orders");
  return { success: true };
}

export async function dealerDispatchOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const { error } = await supabase.from("bridge_orders").update({ status: "dealer_dispatched" }).eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/dealer/orders");
  return { success: true };
}

export async function adminVerifyOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const who = await marketplaceStaff(supabase);
  if ("error" in who) return { error: who.error };

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const { error } = await supabase.from("bridge_orders").update({ status: "staff_verified" }).eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/admin/bridge-orders");
  return { success: true };
}

export async function adminMarkDelivered(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const who = await marketplaceStaff(supabase);
  if ("error" in who) return { error: who.error };

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const { error } = await supabase.from("bridge_orders").update({ status: "delivered" }).eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/admin/bridge-orders");
  return { success: true };
}

export async function recordOrderAdvancePayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const who = await marketplaceStaff(supabase);
  if ("error" in who) return { error: who.error };

  const orderId = String(formData.get("order_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const accountId = (formData.get("account_id") as string) || null;
  const paymentMethod = String(formData.get("payment_method") ?? "");
  if (!orderId) return { error: "Missing order id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Account select karein." };
  if (!paymentMethod) return { error: "Payment method select karein." };

  const { data: order } = await supabase.from("bridge_orders").select("advance_required, advance_paid, order_number").eq("id", orderId).single();
  if (!order) return { error: "Order nahi mili." };
  const remaining = Number(order.advance_required) - Number(order.advance_paid);
  if (amount > remaining) return { error: `Sirf Rs ${remaining.toLocaleString()} baaqi hai.` };

  await supabase
    .from("bridge_orders")
    .update({ advance_paid: Number(order.advance_paid) + amount, last_payment_method: paymentMethod })
    .eq("id", orderId);

  await supabase.from("finance_transactions").insert({
    account_id: accountId,
    transaction_type: "income",
    category: "Marketplace - Advance Payment",
    amount,
    transaction_date: aajKaKhana(),
    notes: `Order ${order.order_number} - Advance payment (${paymentMethod})`,
    created_by: who.userId,
  });
  // Balance yahan se NAHI hilaya jata. finance_transactions mein qatar
  // daalte hi trigger khud hila deta hai (023, aur 127 se ab mitane aur
  // badalne par bhi). Pehle yahan dobara bhi hilaya jata tha, yani Rs
  // 1,000 ka asar Rs 2,000 hota tha.

  revalidatePath("/admin/bridge-orders");
  revalidatePath("/admin/finance");
  return { success: true };
}