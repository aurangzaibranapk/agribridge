"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";

/**
 * Adhoore products ka safha (258): ek form, kai products, jo maloom ho
 * wo bhar do.
 *
 * Wohi usool jo Rate Baqi (product-rates.ts) par hain:
 *  - Khali khana kuch nahi badalta. Khali = "abhi bhi maloom nahi".
 *  - Sale rate 0 qabool nahi -- 0 counter par muft hai.
 * Aur do naye:
 *  - Barcode normalize ho kar jata hai; jo barcode kisi aur product par
 *    pehle se hai wo lagta nahi, saaf bataya jata hai.
 *  - Manzoori (is_verified) sirf Owner/Admin -- warehouse wala rate aur
 *    barcode bhar sakta hai, product ko "theek hai" nahi keh sakta.
 */

export interface SetupState {
  error?: string;
  notice?: string;
  success?: boolean;
  saved?: number;
}

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];
const APPROVERS = ["owner", "super_admin", "admin"];

export async function saveSetupQueue(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale ka hai." };
  }
  const canApprove = APPROVERS.includes(me.role);

  const ids = formData.getAll("id").map(String);
  if (ids.length === 0) return { error: "Koi qatar nahi mili." };

  const num = (raw: string): number | null => {
    const s = raw.trim();
    if (!s) return null;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  let saved = 0;
  const problems: string[] = [];

  for (const id of ids) {
    const sale = num(String(formData.get(`sale_${id}`) ?? ""));
    const trade = num(String(formData.get(`trade_${id}`) ?? ""));
    const barcodeRaw = String(formData.get(`barcode_${id}`) ?? "").trim();
    const approve = formData.get(`verify_${id}`) === "on";

    if (sale === null && trade === null && !barcodeRaw && !approve) continue;

    const { data: p } = await supabase
      .from("products")
      .select("name, is_verified, barcode")
      .eq("id", id)
      .maybeSingle();
    if (!p) continue;

    const update: Record<string, unknown> = {};

    if (sale !== null) {
      if (sale === 0) {
        problems.push(`${p.name}: sale rate 0 nahi ho sakta — khali chhoR dein ya asal rate likhein.`);
      } else {
        update.selling_price = sale;
        update.sale_rate_pending = false;
      }
    }
    if (trade !== null) {
      update.purchase_price = trade;
      update.trade_rate_pending = false;
    }

    if (barcodeRaw) {
      const bc = normalizeBarcode(barcodeRaw);
      if (!bc) {
        problems.push(`${p.name}: barcode parha nahi gaya.`);
      } else {
        const { data: clash } = await supabase
          .from("products")
          .select("id, name")
          .eq("barcode", bc)
          .eq("is_deleted", false)
          .neq("id", id)
          .maybeSingle();
        if (clash) {
          problems.push(`${p.name}: barcode ${bc} pehle se "${clash.name}" par laga hai.`);
        } else {
          update.barcode = bc;
          if (!isValidBarcode(bc)) {
            problems.push(`${p.name}: barcode ${bc} lag gaya magar us ka check digit nahi milta — dobara scan kar ke dekh lein.`);
          }
        }
      }
    }

    if (approve && !p.is_verified) {
      if (canApprove) update.is_verified = true;
      else problems.push(`${p.name}: manzoori sirf Owner/Admin de sakta hai.`);
    }

    if (Object.keys(update).length === 0) continue;
    update.updated_at = new Date().toISOString();

    const { error } = await supabase.from("products").update(update).eq("id", id);
    if (error) {
      problems.push(`${p.name}: ${error.message}`);
      continue;
    }
    saved += 1;
  }

  if (saved > 0) {
    await logAudit({
      actionType: "update",
      module: "products",
      recordId: ids[0],
      recordLabel: "Adhoore products",
      description: `${saved} products ki setup queue se kami poori hui`,
    });
  }

  revalidatePath("/admin/products/setup-queue");
  revalidatePath("/admin/products/rates-baqi");
  revalidatePath("/admin/products/pending");
  revalidatePath("/admin/products");
  revalidatePath("/admin/pos");

  if (saved === 0) {
    return { error: problems.length > 0 ? problems.join(" | ") : "Kuch bhara nahi gaya." };
  }
  return {
    success: true,
    saved,
    notice: problems.length === 0 ? undefined : `Kuch nahi charha: ${problems.slice(0, 4).join(" | ")}`,
  };
}
