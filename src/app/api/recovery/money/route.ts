import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_PROOF_BYTES = 8 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const { data: isStaff } = await (supabase as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });

  const form = await req.formData();
  const direction = String(form.get("direction") ?? "");
  const amount = Number(form.get("amount") ?? 0);
  const partyName = String(form.get("partyName") ?? "").trim();
  if (!['receive', 'pay'].includes(direction)) return NextResponse.json({ error: "Receive ya Pay chunein." }, { status: 400 });
  if (!(amount > 0) || !partyName) return NextResponse.json({ error: "Party aur sahi raqam zaroori hain." }, { status: 400 });

  let beneficiaryName = String(form.get("beneficiaryName") ?? "").trim();
  let beneficiaryAccount = String(form.get("beneficiaryAccount") ?? "").trim();
  let destinationId = String(form.get("destinationId") ?? "").trim();
  if (direction === "pay") {
    const institutionKey = String(form.get("institutionKey") ?? "");
    const [channelType = "", institutionName = ""] = institutionKey.split("|", 2);
    if (destinationId) {
      const { data: saved, error: savedError } = await (supabase as any)
        .from("recovery_payment_destinations")
        .select("id,institution_name,account_title,account_number")
        .eq("id", destinationId).eq("is_active", true).maybeSingle();
      if (savedError || !saved) return NextResponse.json({ error: "Saved recipient account nahi mila." }, { status: 400 });
      beneficiaryName = saved.account_title;
      beneficiaryAccount = `${saved.institution_name} — ${saved.account_number}`;
    } else {
      if (!channelType || !institutionName || !beneficiaryName || !beneficiaryAccount) {
        return NextResponse.json({ error: "Recipient bank/wallet, account title aur account/IBAN/mobile zaroori hain." }, { status: 400 });
      }
      if (form.get("saveDestination") === "on") {
        const { data: savedId, error: destinationError } = await (supabase as any).rpc("fn_save_recovery_payment_destination", { p_input: {
          partyType: String(form.get("partyType") ?? "other"), partyId: String(form.get("partyId") ?? ""), partyName,
          channelType, institutionName, accountTitle: beneficiaryName, accountNumber: beneficiaryAccount,
        } });
        if (destinationError) return NextResponse.json({ error: destinationError.message }, { status: 400 });
        destinationId = savedId;
      }
      beneficiaryAccount = `${institutionName} — ${beneficiaryAccount}`;
    }
  }

  let proofUrl: string | null = String(form.get("proofUrl") ?? "").trim() || null;
  const proof = form.get("proof");
  if (proof instanceof File && proof.size > 0) {
    if (proof.size > MAX_PROOF_BYTES) return NextResponse.json({ error: "Proof file 8 MB se chhoti honi chahiye." }, { status: 400 });
    if (!ALLOWED_PROOF_TYPES.has(proof.type)) return NextResponse.json({ error: "Proof JPG, PNG, WebP ya PDF hona chahiye." }, { status: 400 });
    const safeName = proof.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `recovery/${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const service = createServiceClient();
    const { error: uploadError } = await service.storage.from("payment-slips").upload(path, proof, { contentType: proof.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: `Proof upload nahi hua: ${uploadError.message}` }, { status: 400 });
    proofUrl = service.storage.from("payment-slips").getPublicUrl(path).data.publicUrl;
  }

  const input = {
    direction,
    partyType: String(form.get("partyType") ?? "other"),
    partyId: String(form.get("partyId") ?? ""),
    partyName,
    amount,
    paymentDate: String(form.get("paymentDate") ?? ""),
    financeAccountId: String(form.get("financeAccountId") ?? ""),
    againstAccountCode: String(form.get("againstAccountCode") ?? ""),
    purpose: String(form.get("purpose") ?? ""),
    billReference: String(form.get("billReference") ?? ""),
    beneficiaryName,
    beneficiaryAccount,
    destinationId,
    proofUrl,
    notes: String(form.get("notes") ?? ""),
    backdateReason: String(form.get("backdateReason") ?? ""),
    clientActionId: String(form.get("clientActionId") ?? ""),
  };
  const { data, error } = await (supabase as any).rpc("fn_record_recovery_money", { p_input: input });
  if (error) {
    // Database ki asal wajah (message + hint/detail) user tak pohanche, khamosh fail na ho.
    const extra = [error.details, error.hint].filter((x: unknown) => typeof x === "string" && x.trim()).join(" ");
    return NextResponse.json({ error: extra ? `${error.message} (${extra})` : error.message || "Payment database mein save nahi hui." }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...data });
}
