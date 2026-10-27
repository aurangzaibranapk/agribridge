import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendInterviewReminderEmail } from "@/lib/email";
import { dispatchNotice } from "@/lib/jobs/candidate-message";

export const dynamic = "force-dynamic";

// cPanel Cron Job hits this URL once daily (e.g. 9am):
// curl "https://alranatraders.pk/api/cron/interview-reminders?token=YOUR_SECRET"
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data: applications } = await serviceClient
    .from("job_applications")
    .select("id, full_name, email, interview_date, job_vacancies(title)")
    .eq("status", "interview_scheduled")
    .eq("interview_date", tomorrowStr);

  let sentCount = 0;
  for (const app of applications ?? []) {
    const jobTitle = Array.isArray(app.job_vacancies) ? (app.job_vacancies[0] as any)?.title : (app.job_vacancies as any)?.title;
    const mail = await sendInterviewReminderEmail(app.email, app.full_name, jobTitle ?? "Position", app.interview_date as string);
    const { error: logError } = await serviceClient.from("job_application_messages").insert({
      application_id: app.id,
      channel: mail.channel,
      to_address: mail.to,
      subject: mail.subject,
      body: mail.body,
      link_url: mail.linkUrl,
      attachment_name: mail.attachmentName,
      status: mail.status,
      error: mail.error,
      triggered_by: null,
    });
    if (logError) console.error("interview reminder log:", logError.message);
    if (dispatchNotice(mail)) console.error("interview reminder:", dispatchNotice(mail));
    if (mail.status === "sent") sentCount += 1;
  }

  return NextResponse.json({ success: true, sent: sentCount, date: tomorrowStr });
}