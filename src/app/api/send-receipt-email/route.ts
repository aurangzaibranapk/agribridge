import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { sendDeptMail, mailWrapper } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  // Bina rok ke ye SMTP ka khula darwaza tha — koi bhi kisi ko bhi email
  // bhej sakta tha. Ise POS ka receipt bhejne wala staff hi chalata hai.
  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { to, subject, text } = await req.json();

  if (!to || !subject || !text) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Dukan ki raseed dukan ke khate se. Pehle yahan `SMTP_USER` tha --
  // ek tesra khata jo kisi aur jagah likha hi nahi tha, aur us ki wajah
  // se raseed ki mail chup chaap ruki rehti thi (`src/lib/mailer.ts`).
  const sent = await sendDeptMail({
    dept: "sales",
    to,
    subject,
    html: mailWrapper(
      `<p>${String(text).replace(/\n/g, "<br />")}</p>`,
      "sales"
    ),
  });

  if (!sent.sent) {
    console.error("Email send error:", sent.error);
    return NextResponse.json({ error: sent.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, from: sent.from });
}
