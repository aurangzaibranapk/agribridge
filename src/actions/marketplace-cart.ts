"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { findFarmerByPhone } from "@/lib/farmers/identity";
import { notifyRoles } from "@/lib/notifications";

export interface CartState {
  error?: string;
  success?: boolean;
  orderNumbers?: string[];
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const COD_MIN_QUANTITY = 60;
const COD_MAX_DISTANCE_KM = 30;

interface CartItem {
  product_id: string;
  quantity: number;
}

export async function submitMarketplaceCart(_prev: CartState, formData: FormData): Promise<CartState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneNumber = normalizePhone(String(formData.get("phone_number") ?? ""));
  const deliveryAddress = String(formData.get("delivery_address") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const tehsil = String(formData.get("tehsil") ?? "").trim();
  const paymentMode = String(formData.get("payment_mode") ?? "");
  const cartJson = String(formData.get("cart_json") ?? "[]");

  const customerLat = formData.get("customer_lat") ? Number(formData.get("customer_lat")) : null;
  const customerLng = formData.get("customer_lng") ? Number(formData.get("customer_lng")) : null;

  if (!fullName) return { error: "Naam likhein." };
  if (phoneNumber.length < 10) return { error: "Sahi mobile number likhein." };
  if (!deliveryAddress) return { error: "Delivery address likhein." };
  if (!["advance", "cod"].includes(paymentMode)) return { error: "Payment method select karein." };

  let cart: CartItem[] = [];
  try {
    cart = JSON.parse(cartJson);
  } catch {
    return { error: "Cart sahi tarah nahi mila." };
  }
  if (cart.length === 0) return { error: "Cart khali hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let farmerId: string;
  if (user) {
    const { data: existingFarmer } = await serviceClient.from("farmers").select("id, organization_id").eq("user_id", user.id).maybeSingle();
    if (existingFarmer) {
      farmerId = existingFarmer.id;
    } else {
      return { error: "Account mein masla hai, dobara login karein." };
    }
  } else {
    // Number ki asal par talash (migration 124) -- warna wahi banda jo
    // pehle 0300-1234567 likh kar bana tha, ab +92300... likhne par naya
    // khata bana leta hai aur us ka purana udhaar peeche reh jata hai.
    const byPhone = await findFarmerByPhone(serviceClient, phoneNumber);
    if (byPhone) {
      farmerId = byPhone.id;
    } else {
      // farmer_code database khud bharta hai (migration 121).
      const { data: newFarmer, error: farmerError } = await serviceClient
        .from("farmers")
        .insert({ full_name: fullName, phone_number: phoneNumber, district: district || null, registration_source: "SELF" })
        .select("id")
        .single();
      if (farmerError) return { error: farmerError.message };
      farmerId = newFarmer.id;
    }
  }

  const { data: farmer } = await serviceClient.from("farmers").select("organization_id").eq("id", farmerId).single();

  const matchedItems: { product_id: string; quantity: number; unit_price: number; dealer_id: string | null; line_total: number }[] = [];
  for (const item of cart) {
    if (!item.product_id || !item.quantity || item.quantity <= 0) continue;
    const { data: offers } = await serviceClient.rpc("fn_find_marketplace_offer", {
      p_product_id: item.product_id,
      p_quantity: item.quantity,
      p_organization_id: farmer?.organization_id ?? null,
    });
    if (!offers || offers.length === 0) {
      const { data: product } = await serviceClient.from("products").select("name").eq("id", item.product_id).single();
      return { error: `${product?.name ?? "Ek product"} abhi stock mein nahi hai.` };
    }
    const offer = offers[0];
    matchedItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: Number(offer.unit_price),
      dealer_id: offer.dealer_id ?? null,
      line_total: item.quantity * Number(offer.unit_price),
    });
  }

  if (matchedItems.length === 0) return { error: "Cart mein koi valid item nahi hai." };

  const totalQuantity = matchedItems.reduce((s, i) => s + i.quantity, 0);
  let finalPaymentMode = paymentMode;

  if (paymentMode === "cod") {
    let codEligible = totalQuantity >= COD_MIN_QUANTITY;

    if (codEligible) {
      if (customerLat === null || customerLng === null) {
        codEligible = false;
      } else {
        const dealerIds = Array.from(new Set(matchedItems.map((i) => i.dealer_id).filter((id): id is string => !!id)));
        const { data: dealerLocations } = dealerIds.length
          ? await serviceClient.from("dealers").select("id, latitude, longitude").in("id", dealerIds)
          : { data: [] };
        const dealerLocMap = new Map((dealerLocations ?? []).map((d) => [d.id, d]));

        const { data: warehouses } = await serviceClient
          .from("warehouses")
          .select("latitude, longitude")
          .eq("organization_id", farmer?.organization_id ?? "")
          .not("latitude", "is", null);

        for (const item of matchedItems) {
          let sellerDistance: number | null = null;
          if (item.dealer_id) {
            const loc = dealerLocMap.get(item.dealer_id);
            if (loc?.latitude && loc?.longitude) {
              sellerDistance = distanceKm(customerLat, customerLng, Number(loc.latitude), Number(loc.longitude));
            }
          } else if (warehouses && warehouses.length > 0) {
            sellerDistance = Math.min(
              ...warehouses.map((w) => distanceKm(customerLat, customerLng, Number(w.latitude), Number(w.longitude)))
            );
          }
          if (sellerDistance === null || sellerDistance > COD_MAX_DISTANCE_KM) {
            codEligible = false;
            break;
          }
        }
      }
    }

    if (!codEligible) finalPaymentMode = "advance";
  }

  const groups = new Map<string, typeof matchedItems>();
  for (const item of matchedItems) {
    const key = item.dealer_id ?? "own_stock";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const cartGroupId = crypto.randomUUID();
  const orderNumbers: string[] = [];

  for (const [dealerKey, items] of groups) {
    const subtotal = items.reduce((s, i) => s + i.line_total, 0);
    const advanceRequired = finalPaymentMode === "cod" ? Math.round(subtotal * 0.2) : subtotal;
    const orderNumber = `MKT-${Date.now()}-${orderNumbers.length}`;

    const { data: order, error: orderError } = await supabase
      .from("bridge_orders")
      .insert({
        order_number: orderNumber,
        farmer_id: farmerId,
        assigned_dealer_id: dealerKey === "own_stock" ? null : dealerKey,
        status: "assigned",
        source: "marketplace",
        district: district || "Unknown",
        tehsil: tehsil || null,
        subtotal,
        delivery_address: deliveryAddress,
        payment_mode: finalPaymentMode,
        advance_required: advanceRequired,
        cart_group_id: cartGroupId,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (orderError || !order) return { error: orderError?.message ?? "Order banane mein masla hua." };

    const { error: itemsError } = await supabase.from("bridge_order_items").insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.line_total,
      }))
    );
    if (itemsError) return { error: itemsError.message };

    orderNumbers.push(orderNumber);
  }

  await notifyRoles(
    ["sales_staff", "manager", "super_admin", "admin", "owner"],
    "Naya Marketplace Order",
    `${fullName} ne order kiya hai - ${orderNumbers.join(", ")}`,
    `/admin/bridge-orders`
  );

  revalidatePath("/marketplace");
  return { success: true, orderNumbers };
}