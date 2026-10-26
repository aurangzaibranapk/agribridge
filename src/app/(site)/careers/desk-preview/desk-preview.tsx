"use client";
import { ApplicationTimeline, type TimelineMessage } from "@/app/admin/job-applications/timeline";

const messages: TimelineMessage[] = [
  {
    id: "m1",
    channel: "email",
    to_address: "usama@example.com",
    subject: "You Have Been Shortlisted - Milk Collection Officer",
    body: "<p>Dear Usama,</p><p>You have been shortlisted.</p>",
    link_url: null,
    attachment_name: null,
    status: "sent",
    error: null,
    triggered_name: "HR Admin",
    created_at: "2026-10-22T09:44:00Z",
  },
  {
    id: "m2",
    channel: "email",
    to_address: null,
    subject: "Interview Invitation",
    body: null,
    link_url: null,
    attachment_name: null,
    status: "failed",
    error: "Email nahi bheji: candidate ka email darj nahi.",
    triggered_name: "HR Admin",
    created_at: "2026-10-22T10:00:00Z",
  },
  {
    id: "m3",
    channel: "email",
    to_address: "usama@example.com",
    subject: "Job Offer - Milk Collection Officer",
    body: "<p>Offer letter attached.</p><p>https://alranatraders.pk/job-offer/demo</p>",
    link_url: "https://alranatraders.pk/job-offer/demo",
    attachment_name: "Offer-Letter-Usama.pdf",
    status: "sent",
    error: null,
    triggered_name: "HR Admin",
    created_at: "2026-10-22T11:00:00Z",
  },
];

/** Local preview of the job-applications list and timeline. Not a public page in production. */
export function DeskPreview() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-3 text-lg font-semibold text-surface-900">Job Applications</h1>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left">
              <th className="px-3 py-2 font-medium text-surface-500">Name</th>
              <th className="px-3 py-2 font-medium text-surface-500" data-testid="job-app-gender">Gender</th>
              <th className="px-3 py-2 font-medium text-surface-500">Vacancy</th>
              <th className="px-3 py-2 font-medium text-surface-500">Contact</th>
              <th className="px-3 py-2 font-medium text-surface-500">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-2">M Usama Saleem</td>
              <td className="px-3 py-2">Male</td>
              <td className="px-3 py-2">Milk Collection Officer</td>
              <td className="px-3 py-2">usama@example.com</td>
              <td className="px-3 py-2">eligible</td>
            </tr>
            <tr className="border-t border-surface-100">
              <td className="px-3 py-2">Ayesha Khan</td>
              <td className="px-3 py-2">Female</td>
              <td className="px-3 py-2">Milk Collection Officer</td>
              <td className="px-3 py-2">ayesha@example.com</td>
              <td className="px-3 py-2">pending</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 max-w-lg rounded-card border border-surface-200 bg-white p-5 shadow-card" data-testid="application-timeline">
        <h2 className="font-semibold text-surface-900">M Usama Saleem</h2>
        <ApplicationTimeline
          events={[{ id: "e1", event_type: "shortlisted", event_description: "Shortlist kiya gaya.", created_at: "2026-10-22T09:44:00Z" }]}
          messages={messages}
        />
      </div>
    </div>
  );
}
