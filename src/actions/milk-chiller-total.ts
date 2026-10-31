"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { diffFields, logAudit } from "@/lib/audit";
import { parseChillerTotal } from "@/lib/milk-chiller-total";
import { phoneReferenceTs, phoneSnfConstant } from "@/lib/milk-phone-lab";

export interface ChillerTotalState {
  error?: string;
  message?: string;
}

const ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];

function missingTable(message: string): boolean {
  return /milk_chiller_totals|schema cache|does not exist/i.test(message);
}

export async function saveChillerTotal(_prev: ChillerTotalState, formData: FormData): Promise<ChillerTotalState> {
  const allowed = await requireAction("milk-collection.chiller", "edit");
  if ("error" in allowed) return { error: allowed.error };
  if (!ROLES.includes(allowed.caller.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };

  const branchId = String(formData.get("branch_id") ?? "").trim();
  const date = String(formData.get("entry_date") ?? "").trim();
  const shift = String(formData.get("shift") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) return { error: "Chiller (branch) chunein." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tareekh likhein." };
  if (shift !== "morning" && shift !== "evening") return { error: "Shift subah ya shaam honi chahiye." };

  const caller = allowed.caller;
  if (!caller.unrestricted && caller.branchId && branchId !== caller.branchId) {
    return { error: "Doosre chiller par nahi likh sakte." };
  }

  const supabase = createClient();
  const { data: rate } = await supabase.from("milk_rate_settings").select("snf_constant, reference_ts").limit(1).maybeSingle();
  const parsed = parseChillerTotal({
    chillerNo: String(formData.get("chiller_no") ?? ""),
    grossL: String(formData.get("gross_liters") ?? ""),
    fat: String(formData.get("fat_percentage") ?? ""),
    lr: String(formData.get("lr") ?? ""),
    snfConstant: phoneSnfConstant(rate?.snf_constant == null ? null : Number(rate.snf_constant)),
    referenceTs: phoneReferenceTs(rate?.reference_ts == null ? null : Number(rate.reference_ts)),
  });
  if ("error" in parsed) return parsed;

  const { data: prior, error: priorError } = await supabase
    .from("milk_chiller_totals")
    .select("id, chiller_no, gross_liters, fat_percentage, lr, snf_percentage, ts_percentage, adjusted_liters")
    .eq("branch_id", branchId)
    .eq("entry_date", date)
    .eq("shift", shift)
    .maybeSingle();
  if (priorError) {
    if (missingTable(priorError.message)) {
      return { error: "Chiller total ka table nahi. Migration 732 pehle Testing par chalao." };
    }
    return { error: "Pehle wala total nahi mila. Dobara koshish karein." };
  }

  const row = {
    branch_id: branchId,
    chiller_no: parsed.chillerNo,
    entry_date: date,
    shift,
    gross_liters: parsed.grossL,
    fat_percentage: parsed.fat,
    lr: parsed.lr,
    snf_percentage: parsed.lab.snf,
    ts_percentage: parsed.lab.ts,
    adjusted_liters: parsed.lab.adjusted,
    snf_constant: parsed.snfConstant,
    reference_ts: parsed.referenceTs,
    updated_by: caller.userId,
    updated_at: new Date().toISOString(),
  };

  let savedId = prior?.id ?? null;
  if (prior) {
    const { error } = await supabase.from("milk_chiller_totals").update(row).eq("id", prior.id);
    if (error) return { error: "Total mahfooz nahi hua. Dobara koshish karein." };
  } else {
    const { data: inserted, error } = await supabase
      .from("milk_chiller_totals")
      .insert({ ...row, created_by: caller.userId })
      .select("id")
      .single();
    if (error) {
      if (missingTable(error.message)) {
        return { error: "Chiller total ka table nahi. Migration 732 pehle Testing par chalao." };
      }
      if (/duplicate|unique/i.test(error.message)) {
        const { data: raced, error: again } = await supabase
          .from("milk_chiller_totals")
          .update(row)
          .eq("branch_id", branchId)
          .eq("entry_date", date)
          .eq("shift", shift)
          .select("id")
          .single();
        if (again) return { error: "Total mahfooz nahi hua. Dobara koshish karein." };
        savedId = raced.id;
      } else {
        return { error: "Total mahfooz nahi hua. Dobara koshish karein." };
      }
    } else {
      savedId = inserted.id;
    }
  }

  await logAudit({
    actionType: prior ? "update" : "create",
    module: "milk_chiller_totals",
    recordId: savedId ?? undefined,
    recordLabel: `${parsed.chillerNo} ${date} ${shift}`,
    description: `Chiller total ${parsed.grossL} L, FAT ${parsed.fat}, LR ${parsed.lr}, SNF ${parsed.lab.snf}, TS ${parsed.lab.ts}, Adjusted ${parsed.lab.adjusted}`,
    changes: diffFields(
      {
        chiller_no: prior?.chiller_no ?? null,
        gross_liters: prior?.gross_liters ?? null,
        fat_percentage: prior?.fat_percentage ?? null,
        lr: prior?.lr ?? null,
        snf_percentage: prior?.snf_percentage ?? null,
        ts_percentage: prior?.ts_percentage ?? null,
        adjusted_liters: prior?.adjusted_liters ?? null,
      },
      {
        chiller_no: parsed.chillerNo,
        gross_liters: parsed.grossL,
        fat_percentage: parsed.fat,
        lr: parsed.lr,
        snf_percentage: parsed.lab.snf,
        ts_percentage: parsed.lab.ts,
        adjusted_liters: parsed.lab.adjusted,
      }
    ),
  });

  revalidatePath("/admin/milk-collection/chiller");
  revalidatePath("/admin/milk-collection/handover");
  return { message: `Mahfooz. SNF ${parsed.lab.snf.toFixed(3)}, TS ${parsed.lab.ts.toFixed(3)}, Adjusted ${parsed.lab.adjusted.toFixed(3)} L.` };
}
