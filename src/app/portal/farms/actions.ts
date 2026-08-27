"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addFarmAction(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  const areaRaw = String(formData.get("area_acres") ?? "");
  const village = String(formData.get("village") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const latRaw = String(formData.get("latitude") ?? "");
  const lngRaw = String(formData.get("longitude") ?? "");
  const ownershipType = String(formData.get("ownership_type") ?? "owned");
  const rentRaw = String(formData.get("rent_per_acre") ?? "");

  if (!name || !areaRaw) {
    redirect("/portal/farms?error=" + encodeURIComponent("Farm name aur area zaroori hain."));
  }
  const { error } = await supabase.from("farms").insert({
    farmer_id: farmer.id,
    name,
    area_acres: parseFloat(areaRaw),
    village: village || null,
    district: district || null,
    latitude: latRaw ? parseFloat(latRaw) : null,
    longitude: lngRaw ? parseFloat(lngRaw) : null,
    ownership_type: ownershipType,
    rent_per_acre: ownershipType === "rented" && rentRaw ? parseFloat(rentRaw) : null,
  });
  if (error) {
    redirect("/portal/farms?error=" + encodeURIComponent("FARM_INSERT: " + error.message));
  }
  revalidatePath("/portal/farms");
  redirect("/portal/farms");
}

export async function deleteFarmAction(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");

  const farmId = String(formData.get("farm_id") ?? "");
  if (!farmId) redirect("/portal/farms?error=" + encodeURIComponent("Farm ID missing."));

  const { error } = await supabase.from("farms").delete().eq("id", farmId).eq("farmer_id", farmer.id);
  if (error) {
    redirect("/portal/farms?error=" + encodeURIComponent("Farm delete nahi ho saki - shayad is par crops/harvest records maujood hain. " + error.message));
  }
  revalidatePath("/portal/farms");
  redirect("/portal/farms");
}