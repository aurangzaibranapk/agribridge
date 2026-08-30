"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";
import { REASON_MIN } from "@/lib/ledger/handover";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Cash bhejna.
 *
 * Yahan raqam cash ke khate se nikal kar 1030 "Cash raaste mein" chali
 * jati hai -- gum nahi hoti, sirf jagah badalti hai, aur us jagah par
 * ek naam laga hota hai. Jab tak lene wala tasdeeq na kare, wo wahin
 * rehti hai aur roz nazar aati rehti hai.
 */
export async function sendCash(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const toProfileId = String(formData.get("to_profile_id") ?? "");
  const carrierId = (formData.get("carrier_profile_id") as string) || null;
  const toBranchId = (formData.get("to_branch_id") as string) || null;
  const amount = Number(formData.get("amount") ?? 0);
  const note = (formData.get("sent_note") as string)?.trim() || null;

  // Cash do jagah se ja sakta hai, aur wo do bilkul alag cheezein hain:
  //
  //   branch_cash  -- branch ke khate ka cash (purana raasta)
  //   my_custody   -- wo cash jo MERE paas hai: khet se aaya hua,
  //                   counter par liya hua, ya kisi ne mujhe diya hua
  //
  // Farq na karein to khet se aaya hua cash bhejte waqt branch ke
  // khate se nikalta hai -- jahan wo kabhi tha hi nahi. Us se branch
  // ka cash kam dikhta hai aur bhejne wale ke naam par wo raqam
  // hamesha ke liye khari reh jati hai.
  const fromSource = String(formData.get("from_source") ?? "branch_cash");
  if (fromSource !== "branch_cash" && fromSource !== "my_custody") {
    return { error: "Cash kahan se ja raha hai, wo theek se batayein." };
  }

  if (!toProfileId) return { error: "Kis ko bhej rahe hain, wo select karein." };
  if (!amount || amount <= 0) return { error: "Raqam sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  if (toProfileId === user.id) {
    return { error: "Apne aap ko cash nahi bheja ja sakta — lene wala koi doosra shakhs hona chahiye." };
  }

  const { data: me } = await service
    .from("profiles")
    .select("branch_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Pehle ledger, phir record. Ulta karein to aisa handover bach sakta
  // hai jo darj to hai magar kisi khate mein gaya nahi -- yani cash
  // kaghaz par branch hi mein para rahega jabke asal mein wo ja chuka
  // hoga.
  // Apni custody se bhej rahe hain to pehle dekh lein ke itna hai
  // bhi. Ye adad ledger se aata hai -- kahin rakha hua nahi.
  if (fromSource === "my_custody") {
    const { data: mine } = await service
      .from("v_cash_custody")
      .select("cash_paas_hai")
      .eq("profile_id", user.id)
      .maybeSingle();
    const paas = Number(mine?.cash_paas_hai ?? 0);
    if (amount > paas + 0.01) {
      return {
        error: `Aap ke paas Rs ${paas.toLocaleString()} hai, magar Rs ${amount.toLocaleString()} bheja ja raha hai.`,
      };
    }
  }

  const posted = await postJournal({
    description: `Cash bheja — Rs ${amount.toLocaleString()}${note ? ` (${note})` : ""}`,
    sourceModule: "cash_handover",
    branchId: me?.branch_id ?? null,
    createdBy: user.id,
    lines: [
      {
        account: ACC.cashWithPerson,
        debit: amount,
        partyType: "staff",
        partyId: toProfileId,
        memo: note,
      },
      // Apni custody se ja raha ho to mere naam se nikalta hai, branch
      // ke khate se nahi.
      fromSource === "my_custody"
        ? {
            account: ACC.cashWithPerson,
            credit: amount,
            partyType: "staff",
            partyId: user.id,
            memo: note,
          }
        : { account: ACC.cash, credit: amount, memo: note },
    ],
  });
  if ("error" in posted) return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };

  const { error } = await service.from("cash_handovers").insert({
    from_profile_id: user.id,
    from_branch_id: me?.branch_id ?? null,
    to_profile_id: toProfileId,
    to_branch_id: toBranchId,
    carrier_profile_id: carrierId,
    amount_sent: amount,
    from_source: fromSource,
    sent_note: note,
    sent_entry_id: posted.id,
    status: "sent",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/cash-handover");
  revalidatePath("/admin/money-trail");
  return {
    success: true,
    message: `Rs ${amount.toLocaleString()} bheja hua darj ho gaya. Ab lene wale ki tasdeeq ka intezar hai — tab tak ye raqam "raaste mein" nazar aayegi.`,
  };
}

/**
 * Cash wusool karna.
 *
 * Sirf WOHI shakhs kar sakta hai jis ke naam bheja gaya. Bhejne wale ko
 * ye ijazat dena poore amal ko bekaar kar deta: wo apni marzi ka adad
 * dono taraf likh deta aur farq kabhi nahi nikalta.
 */
export async function receiveCash(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const handoverId = String(formData.get("handover_id") ?? "");
  const received = Number(formData.get("amount_received") ?? 0);
  const reason = String(formData.get("difference_reason") ?? "").trim();

  if (!handoverId) return { error: "Handover select karein." };
  if (!Number.isFinite(received) || received < 0) return { error: "Wusool hui raqam sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: h } = await service
    .from("cash_handovers")
    .select("id, amount_sent, to_profile_id, to_branch_id, status")
    .eq("id", handoverId)
    .maybeSingle();

  if (!h) return { error: "Handover nahi mila." };
  if (h.status !== "sent") return { error: "Ye handover pehle hi mukammal ho chuka hai." };

  if (h.to_profile_id !== user.id) {
    return {
      error:
        "Ye cash aap ke naam nahi bheja gaya. Wusooli sirf wohi shakhs darj kar sakta hai jis ke naam bheji gayi ho.",
    };
  }

  const sent = Number(h.amount_sent);
  const difference = Math.round((received - sent) * 100) / 100;

  if (difference !== 0 && reason.length < REASON_MIN) {
    const kam = difference < 0 ? "kam" : "zyada";
    return {
      error: `Rs ${Math.abs(difference).toLocaleString()} ${kam} pahunche hain. Kya samajh aaya, wo likhna zaroori hai — kam az kam ${REASON_MIN} harf.`,
    };
  }

  const { data: me } = await service
    .from("profiles")
    .select("branch_id")
    .eq("id", user.id)
    .maybeSingle();
  const branchId = h.to_branch_id ?? me?.branch_id ?? null;

  // Raaste wala khata poori BHEJI HUI raqam se khali hota hai -- utni hi
  // jitni nikli thi. Cash utna barhta hai jitna waqai mila, aur farq
  // 6100 mein jata hai. Raaste wale khate ko sirf mili hui raqam se
  // khali karein to baqi wahan hamesha ke liye para reh jayega aur us
  // par kabhi sawal nahi hoga.
  //
  // Aur ek baat jo pehle chhoot gayi thi: raaste wale khate se
  // nikalte waqt bhi WOHI NAAM likhna zaroori hai jo daalte waqt
  // likha tha. Bhejte waqt naam likha jata tha magar wusooli par
  // nahi -- yani us bande ke naam par raqam hamesha ke liye khari
  // reh jati thi, chahe wo pahunchayi ja chuki ho. "Kis ke paas
  // kitna cash hai" wala hisaab isi wajah se kabhi sifar nahi hota
  // tha.
  const lines: Array<{
    account: string;
    debit?: number;
    credit?: number;
    memo?: string | null;
    partyType?: string | null;
    partyId?: string | null;
  }> = [];
  if (received > 0) lines.push({ account: ACC.cash, debit: received, memo: "Cash wusool hua" });
  if (difference < 0) {
    lines.push({ account: ACC.cashDifference, debit: Math.abs(difference), memo: reason });
  }
  if (difference > 0) {
    lines.push({ account: ACC.cashDifference, credit: difference, memo: reason });
  }
  lines.push({
    account: ACC.cashWithPerson,
    credit: sent,
    partyType: "staff",
    partyId: h.to_profile_id,
    memo: "Raasta mukammal",
  });

  const posted = await postJournal({
    description: `Cash wusool — Rs ${received.toLocaleString()}${
      difference !== 0 ? ` (Rs ${Math.abs(difference).toLocaleString()} ${difference < 0 ? "kam" : "zyada"})` : ""
    }`,
    sourceModule: "cash_handover",
    sourceId: handoverId,
    branchId,
    createdBy: user.id,
    lines,
  });
  if ("error" in posted) return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };

  const { error } = await service
    .from("cash_handovers")
    .update({
      amount_received: received,
      received_at: new Date().toISOString(),
      received_by: user.id,
      difference,
      difference_reason: difference === 0 ? null : reason,
      received_entry_id: posted.id,
      status: difference === 0 ? "received" : "short",
    })
    .eq("id", handoverId);

  if (error) return { error: error.message };

  revalidatePath("/admin/cash-handover");
  revalidatePath("/admin/money-trail");
  return {
    success: true,
    message:
      difference === 0
        ? `Rs ${received.toLocaleString()} poore mile — hisaab barabar.`
        : `Rs ${Math.abs(difference).toLocaleString()} ${
            difference < 0 ? "kam" : "zyada"
          } mile. Farq "Cash ka farq" khate mein darj ho gaya — chhupa nahi.`,
  };
}
