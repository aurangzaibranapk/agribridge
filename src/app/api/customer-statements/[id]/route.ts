import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateCustomerStatementPdf } from "@/lib/customer-statement-pdf";
import { mailWrapper, sendDeptMail } from "@/lib/mailer";
import { sendWhatsAppDocument } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const { data: isStaff } = await (auth as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });

  const body = await req.json();
  const channel = String(body.channel || "download");
  const start = body.start || null;
  const end = body.end || null;
  // Farmer aur Customer ka khata statement ab EK hi raasta hai (424) --
  // Malik: "farmer ho ya customer, dono ek hi cheez honi chahiye."
  const partyType = body.partyType === "farmer" ? "farmer" : "customer";
  const service = createServiceClient() as any;

  const party =
    partyType === "farmer"
      ? await service.from("farmers").select("id,full_name,phone_number,whatsapp_number,email").eq("id", id).maybeSingle()
      : await service.from("customers").select("id,name,phone_number,email").eq("id", id).maybeSingle();
  if (!party.data) return NextResponse.json({ error: partyType === "farmer" ? "Farmer not found." : "Customer not found." }, { status: 404 });
  const partyName = partyType === "farmer" ? party.data.full_name ?? "Farmer" : party.data.name;
  const partyPhone = partyType === "farmer" ? party.data.whatsapp_number ?? party.data.phone_number : party.data.phone_number;
  const partyEmail = party.data.email;
  const ledgerFn = partyType === "farmer" ? "fn_farmer_combined_ledger" : "fn_customer_ledger";
  const ledgerArgKey = partyType === "farmer" ? "p_farmer" : "p_customer";

  const openingEnd = start ? new Date(`${start}T00:00:00Z`) : null;
  if (openingEnd) openingEnd.setUTCDate(openingEnd.getUTCDate() - 1);
  const [{ data: rows, error }, { data: openingRows }] = await Promise.all([
    service.rpc(ledgerFn, { [ledgerArgKey]: id, p_start: start, p_end: end }),
    start
      ? service.rpc(ledgerFn, { [ledgerArgKey]: id, p_start: null, p_end: openingEnd!.toISOString().slice(0, 10) })
      : Promise.resolve({ data: [] }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const entries = rows || [];
  const openingBalance = (openingRows || []).reduce((sum: number, r: any) => sum + Number(r.debit || 0) - Number(r.credit || 0), 0);
  const closingBalance = entries.reduce((sum: number, r: any) => sum + Number(r.debit || 0) - Number(r.credit || 0), openingBalance);
  const pdf = await generateCustomerStatementPdf({ customerName: partyName, fromDate: start, toDate: end, openingBalance, closingBalance, rows: entries });
  const filename = `ART-${partyName.replace(/[^a-z0-9]+/gi, "-")}-statement.pdf`;

  if (channel === "download") {
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
  }

  let recipient = channel === "email" ? partyEmail : partyPhone;
  let deliveryStatus = "failed";
  let failureReason: string | null = null;
  let documentUrl: string | null = null;
  try {
    if (!recipient) throw new Error(channel === "email" ? "Email is missing." : "WhatsApp number is missing.");
    const recipientValue = String(recipient);
    if (channel === "email") {
      const result = await sendDeptMail({
        dept: "accounts",
        to: recipientValue,
        subject: `Al Rana Traders Khata Statement - ${partyName}`,
        html: mailWrapper(`<p>Assalam-o-Alaikum <strong>${partyName}</strong>,</p><p>Your Al Rana Traders Khata statement is attached.</p><p><strong>Closing balance:</strong> Rs ${Math.round(closingBalance).toLocaleString("en-PK")}</p>`, "accounts"),
        attachments: [{ filename, content: pdf }],
      });
      if (!result.sent) throw new Error(result.error);
    } else if (channel === "whatsapp") {
      const path = `${id}/${Date.now()}-${filename}`;
      const upload = await service.storage.from("statement-files").upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (upload.error) throw new Error(upload.error.message);
      const signed = await service.storage.from("statement-files").createSignedUrl(path, 60 * 60);
      if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || "Statement ka secure link nahi bana.");
      documentUrl = path;
      await sendWhatsAppDocument(recipientValue, String(signed.data.signedUrl), filename, `Assalam-o-Alaikum ${partyName} Sahib, aap ka Al Rana Traders Khata Statement attached hai. Closing balance: Rs ${Math.round(closingBalance).toLocaleString("en-PK")}.`);
    } else {
      throw new Error("Unsupported channel.");
    }
    deliveryStatus = "sent";
  } catch (err) {
    failureReason = err instanceof Error ? err.message : "Statement send failed.";
  }

  await service.from("statement_share_history").insert({
    party_type: partyType, party_id: id, statement_from_date: start, statement_to_date: end,
    opening_balance: openingBalance, closing_balance: closingBalance, document_url: documentUrl,
    document_format: "pdf", channel, recipient, delivery_status: deliveryStatus,
    sent_by: user.id, sent_at: deliveryStatus === "sent" ? new Date().toISOString() : null, failure_reason: failureReason,
  });

  if (deliveryStatus === "failed") return NextResponse.json({ error: failureReason }, { status: 400 });
  return NextResponse.json({ success: true, status: deliveryStatus });
}
