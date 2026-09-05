"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";
import { quantityReport, REASON_MIN } from "@/lib/ledger/quantity-money";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Kami ko us ka apna khana dena.
 *
 * Yahan NAYA paisa nahi banta. Wo pehle hi kharch ho chuka hai aur
 * ledger mein maujood hai -- bas galat khane mein: "doodh ki khareed"
 * ke andar, jahan wo aam lagat jaisa nazar aata hai. Ye entry us ko
 * wahan se nikal kar "doodh ka nuqsan" mein le jati hai.
 *
 * Kul kharcha wahi rehta hai. Farq sirf itna hai ke ab nuqsan alag
 * nazar aata hai -- aur jo cheez alag nazar aati hai, us par sawal ho
 * sakta hai. Isi liye ye kaam maani rakhta hai.
 *
 * Adad form se nahi liye jate. Ginti dobara SERVER par hoti hai --
 * warna bhejne wala apni marzi ka farq bhej kar apni marzi ki entry
 * bana sakta hai, aur poora amal bekaar ho jata hai.
 */
export async function bookQuantityLoss(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const stream = String(formData.get("stream") ?? "");
  const month = Number(formData.get("month") ?? 0);
  const year = Number(formData.get("year") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();

  if (stream !== "milk" && stream !== "grain") {
    return {
      error:
        "Sirf doodh aur grain ki kami khate mein daali ja sakti hai. Diesel ka paisa pehle hi apni sahi jagah par hai — use dobara daalna wohi ghalti hoti jo hum rok rahe hain.",
    };
  }
  if (!month || !year) return { error: "Mahina aur saal select karein." };
  if (reason.length < REASON_MIN) {
    return { error: `Kami ki wajah likhna zaroori hai — kam az kam ${REASON_MIN} harf.` };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: existing } = await service
    .from("quantity_reconciliations")
    .select("id")
    .eq("stream", stream)
    .eq("period_month", month)
    .eq("period_year", year)
    .is("branch_id", null)
    .maybeSingle();
  if (existing) {
    return { error: "Is mahine ki kami pehle hi khate mein ja chuki hai. Dobara daalne se wohi nuqsan do dafa gin liya jayega." };
  }

  // Ginti server par, form se nahi.
  const report = await quantityReport({ month, year });
  const check = report.streams.find((s) => s.stream === stream);
  if (!check) return { error: "Milaan nahi bana." };

  if (!check.canBook) {
    return { error: "Is hisse ki kami khate mein nahi daali jati — us ka paisa pehle hi apni sahi jagah par hai." };
  }
  if (check.gap <= 0) {
    return { error: "Is mahine koi kami nahi nikli — daalne ko kuch nahi." };
  }
  if (check.gapValue <= 0) {
    return { error: "Kami ki qeemat nahi bani. Rate ya miqdar adhoori hai." };
  }

  // Chiller ki receipt hi darj na hui ho to "kami" asal mein kami nahi,
  // sirf likhna baqi hai. Aise mein entry banana ek jhoota nuqsan
  // hamesha ke liye khate mein daal dega -- aur wo mitaya nahi ja
  // sakega.
  if (check.caveats.some((c) => c.includes("darj nahi hui"))) {
    return {
      error:
        "Pehle wo entriyan mukammal karein jin ki chiller receipt darj nahi hui. Un ke baghair ye kami asal se zyada hai, aur ek dafa khate mein chali gayi to mitegi nahi.",
    };
  }

  const lossAccount = stream === "milk" ? ACC.milkLoss : ACC.grainLoss;
  const purchaseAccount = stream === "milk" ? ACC.milkPurchase : ACC.grainPurchase;
  const label = stream === "milk" ? "Doodh" : "Grain";

  const posted = await postJournal({
    description: `${label} ki kami ${month}/${year} — ${check.gap} ${check.unit}`,
    sourceModule: "quantity_reconciliation",
    createdBy: user.id,
    lines: [
      { account: lossAccount, debit: check.gapValue, memo: reason },
      {
        account: purchaseAccount,
        credit: check.gapValue,
        memo: "Khareed se nikal kar nuqsan mein",
      },
    ],
  });
  if ("error" in posted) return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };

  const { error } = await service.from("quantity_reconciliations").insert({
    stream,
    period_month: month,
    period_year: year,
    branch_id: null,
    qty_in: check.qtyIn,
    qty_out: check.qtyOut,
    qty_gap: check.gap,
    unit: check.unit,
    unit_cost: check.unitCost,
    gap_value: check.gapValue,
    reason,
    journal_entry_id: posted.id,
    booked_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/quantity-money");
  revalidatePath("/admin/money-trail");

  return {
    success: true,
    message: `${check.gap} ${check.unit} ki kami — Rs ${check.gapValue.toLocaleString()} — ab "${label} ka nuqsan" khate mein alag nazar aayegi. Kul kharcha wahi hai; farq sirf ye hai ke ab wo chhupa hua nahi.`,
  };
}
