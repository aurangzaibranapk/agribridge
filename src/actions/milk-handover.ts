"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { diffFields, logAudit } from "@/lib/audit";
import { rpcError } from "@/lib/dairy/rules";
import { adjustedTotal, canSeeHandoverRate, grossTotal, handoverAmount, lineToSql, lrRecipeLabel, parseDestination, parseHandoverLines, parseHandoverReason, parseLrBaseline, baselineForDestination, type HandoverLineInput, type ParsedLine } from "@/lib/milk-handover";
import { loadChillerStock } from "@/lib/milk-handover-stock";
import { createHandoverPartyRecord } from "@/actions/milk-handover-party";

export interface HandoverState {
  error?: string;
  success?: boolean;
}

const ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];

function textOrNull(value: FormDataEntryValue | null, max: number): string | null | { error: string } {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > max) return { error: `Yeh khana ${max} haroof se chhota rakhein.` };
  return raw;
}

function acceptedOf(value: FormDataEntryValue | null): boolean | null | { error: string } {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw === "yes") return true;
  if (raw === "no") return false;
  return { error: "Qubool ya radd saaf chunein." };
}

export async function lookupChillerStock(branchId: string, date: string, shift: string): Promise<HandoverLineInput[]> {
  const allowed = await requireAction("milk-collection.handover", "view");
  if ("error" in allowed) return [];
  return loadChillerStock(branchId, date, shift);
}

export async function saveMilkHandover(_prev: HandoverState, formData: FormData): Promise<HandoverState> {
  const idRaw = String(formData.get("dispatch_id") ?? "").trim();
  const allowed = await requireAction("milk-collection.handover", idRaw ? "edit" : "create");
  if ("error" in allowed) return { error: allowed.error };
  if (!ROLES.includes(allowed.caller.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };

  const branchId = String(formData.get("branch_id") ?? "").trim();
  const date = String(formData.get("dispatch_date") ?? "").trim();
  const shift = String(formData.get("shift") ?? "").trim();
  const timeRaw = String(formData.get("collection_time") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) return { error: "Branch (MCC) chunein." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tareekh likhein." };
  if (shift !== "morning" && shift !== "evening") return { error: "Shift subah ya shaam honi chahiye." };
  if (timeRaw && !/^\d{2}:\d{2}$/.test(timeRaw)) return { error: "Time of Collection ghante aur minute mein likhein." };

  const shopRaw = String(formData.get("shop_id") ?? "").trim();
  if (shopRaw && !/^[0-9a-f-]{36}$/i.test(shopRaw)) return { error: "MCC (dukaan) sahi nahi." };
  if (idRaw && !/^[0-9a-f-]{36}$/i.test(idRaw)) return { error: "Ye certificate sahi nahi." };

  const caller = allowed.caller;
  if (!caller.unrestricted && caller.scope !== "all" && caller.branchId && branchId !== caller.branchId) {
    return { error: "Doosri branch par nahi likh sakte." };
  }

  const mcc = textOrNull(formData.get("mcc_name"), 120);
  if (typeof mcc === "object" && mcc) return mcc;
  const vehicle = textOrNull(formData.get("vehicle_name"), 80);
  if (typeof vehicle === "object" && vehicle) return vehicle;
  const driver = textOrNull(formData.get("driver_name"), 80);
  if (typeof driver === "object" && driver) return driver;
  const notes = textOrNull(formData.get("notes"), 500);
  if (typeof notes === "object" && notes) return notes;
  const reason = textOrNull(formData.get("rejection_reason"), 500);
  if (typeof reason === "object" && reason) return reason;
  const rep = textOrNull(formData.get("licensee_rep_name"), 120);
  if (typeof rep === "object" && rep) return rep;
  const lic = textOrNull(formData.get("licensee_signature"), 120);
  if (typeof lic === "object" && lic) return lic;
  const col = textOrNull(formData.get("collector_signature"), 120);
  if (typeof col === "object" && col) return col;
  const accepted = acceptedOf(formData.get("accepted"));
  if (typeof accepted === "object" && accepted) return accepted;
  if (accepted === false && (!reason || reason.length < 3)) {
    return { error: "Radd ki wajah kam az kam 3 haroof ki likhein." };
  }

  const destination = parseDestination(formData.get("destination"));
  if (!destination) return { error: "Manzil company, vendor ya party honi chahiye." };
  const reasonParsed = parseHandoverReason(formData.get("handover_reason"));
  if (destination === "party" && reasonParsed === "invalid") {
    return { error: "Wajah sale, given, spoil ya other ho — ya khali chhor dein. Kharab lazmi nahi." };
  }
  const handoverReason = destination === "party" && reasonParsed !== "invalid" ? reasonParsed : null;
  let partyId: string | null = null;
  if (destination === "party") {
    const rawParty = String(formData.get("party_id") ?? "").trim();
    if (rawParty === "new") {
      const created = await createHandoverPartyRecord({
        userId: caller.userId,
        name: String(formData.get("party_name") ?? ""),
        contact: String(formData.get("party_contact") ?? "").trim() || null,
        active: true,
      });
      if ("error" in created) return created;
      partyId = created.id;
    } else if (!/^[0-9a-f-]{36}$/i.test(rawParty)) {
      return { error: "Party chunein, ya naya naam likhein." };
    } else {
      partyId = rawParty;
    }
  }
  const baseline = baselineForDestination(destination, parseLrBaseline(formData.get("lr_baseline")));

  const rateRaw = String(formData.get("internal_rate") ?? "").trim();
  let rateValue: number | null = null;
  if (canSeeHandoverRate(caller.role) && rateRaw) {
    if (!/^\d+(\.\d{1,2})?$/.test(rateRaw) || Number(rateRaw) > 1000000) {
      return { error: "Rate sahi rupayon mein likhein (0 se 1000000)." };
    }
    rateValue = Number(rateRaw);
  }

  const locked = String(formData.get("litres_locked") ?? "") === "yes";
  let linesJson: unknown = null;
  let parsedLines: ParsedLine[] | null = null;
  if (!locked) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(String(formData.get("lines_json") ?? "[]"));
    } catch {
      return { error: "Chiller ki qatarein parhi nahi ja sakein." };
    }
    if (!Array.isArray(parsedJson)) return { error: "Chiller ki qatarein nahi aayin." };
    const inputs: HandoverLineInput[] = parsedJson.map((row) => {
      const r = row as Partial<HandoverLineInput>;
      return {
        chillerNo: String(r.chillerNo ?? ""),
        milkType: String(r.milkType ?? ""),
        grossL: String(r.grossL ?? ""),
        fat: String(r.fat ?? ""),
        lr: String(r.lr ?? ""),
        snf: String(r.snf ?? ""),
        adjustedL: String(r.adjustedL ?? ""),
        temperatureC: String(r.temperatureC ?? ""),
        organo: String(r.organo ?? ""),
      };
    });
    const parsed = parseHandoverLines(inputs);
    if ("error" in parsed) return { error: parsed.error };
    parsedLines = parsed.lines;
    linesJson = parsed.lines.map(lineToSql);
  }

  const supabase = createClient();
  const { data: before } = idRaw
    ? await supabase
        .from("milk_dispatches")
        .select("id, dispatched_liters, accepted, rejection_reason, mcc_name, received_liters")
        .eq("id", idRaw)
        .maybeSingle()
    : { data: null };

  const posted = await (createServiceClient() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc("fn_save_milk_handover", {
    p_by: caller.userId,
    p_id: idRaw || null,
    p_branch_id: branchId,
    p_shop_id: shopRaw || null,
    p_date: date,
    p_shift: shift,
    p_collection_time: timeRaw || null,
    p_mcc_name: mcc,
    p_vehicle: vehicle,
    p_driver: driver,
    p_notes: notes,
    p_accepted: accepted,
    p_rejection_reason: reason,
    p_licensee_rep_name: rep,
    p_licensee_signature: lic,
    p_collector_signature: col,
    p_lines: linesJson,
    p_destination: destination,
    p_party_id: partyId,
    p_handover_reason: handoverReason,
    p_lr_baseline: baseline,
  });

  if (posted.error) {
    const message = rpcError(posted.error.message);
    if (/p_destination|destination|fn_save_milk_handover/i.test(message) && /schema cache|could not find|does not exist/i.test(message)) {
      return { error: "Teen manzilen abhi database mein nahi. Migration 729 pehle Testing par chalao — Live se pehle backup. 728 pehle honi chahiye." };
    }
    return { error: message };
  }
  const id = posted.data;
  if (!id) return { error: "Certificate mehfooz nahi hua." };

  if (canSeeHandoverRate(caller.role)) {
    const service = createServiceClient();
    if (rateValue == null) {
      const removed = await service.from("milk_dispatch_rates").delete().eq("dispatch_id", id);
      if (removed.error && !/schema cache|does not exist|milk_dispatch_rates/i.test(removed.error.message)) {
        return { error: removed.error.message };
      }
    } else {
      const { data: stored } = await service
        .from("milk_dispatch_lines")
        .select("gross_volume_l, adjusted_volume_l")
        .eq("dispatch_id", id);
      const adjusted = adjustedTotal(
        (stored ?? []).map((line) => ({
          grossL: Number(line.gross_volume_l),
          adjustedL: line.adjusted_volume_l == null ? null : Number(line.adjusted_volume_l),
        }))
      );
      const amount = handoverAmount(adjusted, rateValue);
      if (amount == null) {
        return { error: "Slip mehfooz ho chuki hai. Amount tab banta hai jab har chiller ka adjusted litre ho." };
      }
      const wrote = await service.from("milk_dispatch_rates").upsert({
        dispatch_id: id,
        rate_per_adjusted_l: rateValue,
        amount,
        updated_by: caller.userId,
      });
      if (wrote.error) {
        if (/schema cache|does not exist|milk_dispatch_rates/i.test(wrote.error.message)) {
          return { error: "Slip mehfooz ho chuki hai. Andaruni rate ka table abhi nahi. Migration 730 pehle Testing par chalao — Live se pehle backup." };
        }
        return { error: wrote.error.message };
      }
    }
  }

  const decision = accepted == null ? "faisla baqi" : accepted ? "qubool" : "radd";
  const gross = parsedLines ? grossTotal(parsedLines) : before ? Number(before.dispatched_liters) : null;
  await logAudit({
    actionType: before ? "update" : "create",
    module: "milk_dispatches",
    recordId: id,
    recordLabel: `${mcc || "MCC"} ${date} ${shift}`,
    description: `Milk Handover ${destination} — ${gross ?? "—"} L, ${decision}, ${lrRecipeLabel(baseline)}${handoverReason ? `, ${handoverReason}` : ""}`,
    changes: before
      ? diffFields(
          {
            accepted: before.accepted,
            rejection_reason: before.rejection_reason,
            dispatched_liters: before.dispatched_liters == null ? null : Number(before.dispatched_liters),
            mcc_name: before.mcc_name,
          },
          {
            accepted,
            rejection_reason: accepted === true ? null : reason,
            dispatched_liters: gross,
            mcc_name: mcc,
          }
        )
      : undefined,
  });

  revalidatePath("/admin/milk-collection/handover");
  revalidatePath("/admin/milk-collection/handover/company");
  revalidatePath("/admin/milk-collection/handover/vendor");
  revalidatePath("/admin/milk-collection/handover/party");
  revalidatePath("/admin/milk-collection/handover/parties");
  revalidatePath(`/admin/milk-collection/handover/${id}`);
  revalidatePath("/admin/milk-collection/dispatch");
  redirect(`/admin/milk-collection/handover/${id}?saved=1`);
}
