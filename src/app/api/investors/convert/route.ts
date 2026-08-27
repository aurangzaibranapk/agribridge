// app/api/investors/convert/route.ts
//
// Sab kuch verify ho chuka hai — koi guess nahi bacha:
//   - createClient ("@/lib/supabase/server") — bridge-ai/route.ts se confirm
//   - createServiceClient ("@/lib/supabase/service") — registration.ts se confirm
//   - investor_code — nextFarmerCode wala hi sequential pattern (registration.ts)
//   - organization_id — DB default (fn_default_organization_id()) khud set karta hai
//   - wallet — investors insert hote hi trigger khud bana deta hai (owner_type='investor')

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";       // <- verify path
import { createServiceClient } from "@/lib/supabase/service";

interface ConvertInquiryPayload {
  inquiryId: string;
  profitSplitPercent?: number;   // default 50
  investmentType?: string;       // falls back to inquiry.interest_type
  createLogin: boolean;
}

export async function POST(req: Request) {
  const body: ConvertInquiryPayload = await req.json();
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const { data: inquiry, error: inquiryError } = await supabase
    .from("investor_inquiries")
    .select("*")
    .eq("id", body.inquiryId)
    .single();

  if (inquiryError || !inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  const investorCode = await nextInvestorCode(serviceClient);

  let userId: string | null = null;
  let tempPassword: string | null = null;

  if (body.createLogin && inquiry.email) {
    tempPassword = crypto.randomUUID().slice(0, 12);

    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email: inquiry.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "investor", full_name: inquiry.name },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    userId = authUser.user.id;
  }

  const { data: investor, error: investorError } = await supabase
    .from("investors")
    .insert({
      user_id: userId,
      investor_code: investorCode,
      full_name: inquiry.name,
      phone_number: inquiry.phone,
      investment_type: body.investmentType ?? inquiry.interest_type,
      profit_split_percent: body.profitSplitPercent ?? 50,
      status: "active",
      is_active: true,
      total_invested: 0,
      source_inquiry_id: body.inquiryId,
    })
    .select()
    .single();

  if (investorError) {
    return NextResponse.json({ error: investorError.message }, { status: 400 });
  }

  // inquiry_status enum mein sirf new/read/responded/closed hain — 'converted'
  // nahi. 'closed' use kar rahe hain; investors.source_inquiry_id se hi pata
  // chal jayega ke ye closure conversion ki wajah se tha.
  await supabase
    .from("investor_inquiries")
    .update({ status: "closed" })
    .eq("id", body.inquiryId);

  // tempPassword investor tak pahunchana hai — offer-letter/ID-card wala
  // credential-sharing pattern (WhatsApp/Email) reuse karein
  return NextResponse.json({ investor, tempPassword });
}

// nextFarmerCode (src/actions/registration.ts) jaisa hi sequential pattern
async function nextInvestorCode(serviceClient: ReturnType<typeof createServiceClient>): Promise<string> {
  const { data } = await serviceClient
    .from("investors")
    .select("investor_code")
    .order("investor_code", { ascending: false })
    .limit(1);
  const lastCode = data?.[0]?.investor_code;
  const lastNumber = lastCode ? parseInt(lastCode.replace("INV-", ""), 10) : 0;
  return `INV-${String(lastNumber + 1).padStart(6, "0")}`;
}