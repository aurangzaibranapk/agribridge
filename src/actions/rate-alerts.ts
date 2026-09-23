"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

/**
 * Rate badalne par tanbeeh kab jaye.
 *
 * 293 ne ye qawaid database mein daal diye the magar unhen badalne ka
 * koi raasta nahi tha -- SQL likhni parti thi. Do adad hain aur dono ka
 * apna kaam hai:
 *
 *   HADD (tolerance): is se chhota farq shor hai. Rs 1 ya aadha fisad
 *      ka farq har roz hota hai; us par har dafa ittila bhejne se log
 *      ittila parhna hi chhoR dete hain.
 *
 *   BARA FARQ (big change): is se bara farq manager tak jata hai. Yehi
 *      wo farq hai jis ke peeche aksar koi wajah hoti hai -- ghalat
 *      rate, ya bazaar ka waqai badalna.
 */

const ROLES = ["owner", "super_admin", "admin"];

export interface RateAlertState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function setRateAlertConfig(_prev: RateAlertState, formData: FormData): Promise<RateAlertState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return { error: "Ye qawaid sirf malik ya admin badal sakte hain." };
  }

  const tolAmt = Number(formData.get("tolerance_amount") ?? -1);
  const tolPct = Number(formData.get("tolerance_pct") ?? -1);
  const bigAmt = Number(formData.get("big_change_amount") ?? -1);
  const bigPct = Number(formData.get("big_change_pct") ?? -1);

  for (const [naam, adad] of [
    ["Hadd (raqam)", tolAmt],
    ["Hadd (fisad)", tolPct],
    ["Bara farq (raqam)", bigAmt],
    ["Bara farq (fisad)", bigPct],
  ] as const) {
    if (!Number.isFinite(adad) || adad < 0) return { error: `${naam}: adad theek nahi.` };
  }
  if (bigAmt < tolAmt || bigPct < tolPct) {
    return { error: "Bara farq hadd se chhota nahi ho sakta — warna har chhota farq bhi 'bara' gina jayega." };
  }

  const service = createServiceClient();
  const { data: pehle } = await service.from("rate_alert_config").select("*").eq("id", 1).maybeSingle();

  const { error } = await service.from("rate_alert_config").upsert({
    id: 1,
    tolerance_amount: tolAmt,
    tolerance_pct: tolPct,
    big_change_amount: bigAmt,
    big_change_pct: bigPct,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "products",
    recordId: "rate_alert_config",
    description: `Rate ki tanbeeh ke qawaid badle: hadd Rs ${tolAmt} / ${tolPct}%, bara farq Rs ${bigAmt} / ${bigPct}%`,
    changes: {
      tolerance_amount: { pehle: pehle?.tolerance_amount ?? null, ab: tolAmt },
      big_change_amount: { pehle: pehle?.big_change_amount ?? null, ab: bigAmt },
    },
  });

  revalidatePath("/admin/finance/costing");
  return { success: true, message: "Qawaid lag gaye. Agli rate ki tabdeeli par yehi hadd chalegi." };
}
