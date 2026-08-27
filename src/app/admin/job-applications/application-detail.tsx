"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { markUnderReview, markEligibility, scheduleInterview, saveInterviewScore, createOfficialLogin, type ActionState } from "@/actions/jobs";
import { suspendStaff, reactivateStaff, deleteStaff, type ActionState as StaffActionState } from "@/actions/users";
import { OfferButton } from "./offer-modal";
import { ResendOfferButton } from "./resend-offer-button";
import { DocumentViewer } from "./document-viewer";
import { ScoreChart } from "./score-chart";
import { ApplicationTimeline } from "./timeline";
import { X, Award, KeyRound, CheckCircle2, Ban, Trash2, RotateCcw } from "lucide-react";

const initialState: ActionState = {};
const staffInitialState: StaffActionState = {};

const DEFAULT_QUESTIONS = [
  "Aap ka kaam ka tajurba kya hai?",
  "Aap sales/customer handling kaise karte hain?",
  "Mushkil customer ko kaise handle karenge?",
  "Aap time management kaise karte hain?",
  "Team mein kaam karne ka tajurba?",
  "Aap ke strengths kya hain?",
  "Aap stress mein kaise kaam karte hain?",
  "Aap hamare business ke baare mein kya jaante hain?",
  "Aap kitni jaldi kaam seekh sakte hain?",
  "Aap ye job kyun karna chahte hain?",
];

interface InterviewScore {
  question_scores: { question: string; score: number }[];
  behavior_score: number;
  attitude_score: number;
  communication_score: number;
  cleanliness_score: number;
  total_score: number;
  recommendation: string;
  notes: string | null;
}
interface TimelineEvent {
  id: string;
  event_type: string;
  event_description: string;
  created_at: string;
}
interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  cnic: string | null;
  expected_salary: number | null;
  qualification: string | null;
  experience: string | null;
  message: string | null;
  status: string;
  is_eligible: boolean | null;
  interview_date: string | null;
  cnic_image_url: string | null;
  cnic_back_image_url: string | null;
  certificate_url: string | null;
  experience_certificate_url: string | null;
  cv_url: string | null;
  interview_score: InterviewScore | null;
  created_profile_id: string | null;
  timeline: TimelineEvent[];
}
interface Branch {
  id: string;
  name: string;
}

export function ApplicationDetailButton({ application, branches }: { application: Application; branches: Branch[] }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={() => setShowModal(true)} className="text-xs font-medium text-brand-600 hover:underline">
          Details Dekhein
        </button>
        {application.created_profile_id && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Joined</span>
        )}
        {application.created_profile_id && <StaffManageButtons applicationId={application.id} profileId={application.created_profile_id} />}
      </div>
      {showModal && <DetailModal application={application} branches={branches} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function StaffManageButtons({ applicationId, profileId }: { applicationId: string; profileId: string }) {
  const [suspendState, suspendAction] = useFormState(suspendStaff, staffInitialState);
  const [reactivateState, reactivateAction] = useFormState(reactivateStaff, staffInitialState);
  const [deleteState, deleteAction] = useFormState(deleteStaff, staffInitialState);
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  void applicationId;

  return (
    <div className="flex items-center gap-1">
      {!showSuspendForm ? (
        <button onClick={() => setShowSuspendForm(true)} title="Suspend" className="rounded-lg p-1 text-amber-600 hover:bg-amber-50">
          <Ban className="h-3.5 w-3.5" />
        </button>
      ) : (
        <form action={suspendAction} className="flex items-center gap-1">
          <input type="hidden" name="profile_id" value={profileId} />
          <input name="reason" placeholder="Wajah" className="w-24 rounded border border-surface-200 p-1 text-xs" />
          <button type="submit" className="rounded bg-amber-600 px-1.5 py-1 text-xs text-white">OK</button>
        </form>
      )}
      <form action={reactivateAction}>
        <input type="hidden" name="profile_id" value={profileId} />
        <button type="submit" title="Reactivate" className="rounded-lg p-1 text-green-600 hover:bg-green-50">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </form>
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm("Kya aap is staff ko delete karna chahte hain?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="profile_id" value={profileId} />
        <button type="submit" title="Delete" className="rounded-lg p-1 text-red-600 hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </form>
      {suspendState.error && <p className="text-xs text-red-600">{suspendState.error}</p>}
      {reactivateState.error && <p className="text-xs text-red-600">{reactivateState.error}</p>}
      {deleteState.error && <p className="text-xs text-red-600">{deleteState.error}</p>}
    </div>
  );
}

function DetailModal({ application, branches, onClose }: { application: Application; branches: Branch[]; onClose: () => void }) {
  const docs = [
    { label: "CNIC Front", url: application.cnic_image_url },
    { label: "CNIC Back", url: application.cnic_back_image_url },
    { label: "Qualification Certificate", url: application.certificate_url },
    { label: "Experience Certificate", url: application.experience_certificate_url },
    { label: "CV / Resume", url: application.cv_url },
  ].filter((d) => d.url) as { label: string; url: string }[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{application.full_name}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-1 text-sm text-surface-600 dark:text-surface-300">
          <p><strong>Email:</strong> {application.email}</p>
          <p><strong>Phone:</strong> {application.phone ?? "-"}</p>
          <p><strong>CNIC:</strong> {application.cnic ?? "-"}</p>
          <p><strong>Address:</strong> {application.address ?? "-"}</p>
          <p><strong>Expected Salary:</strong> {application.expected_salary ? `Rs ${application.expected_salary.toLocaleString()}` : "-"}</p>
          <p><strong>Qualification:</strong> {application.qualification ?? "-"}</p>
          <p><strong>Experience:</strong> {application.experience ?? "-"}</p>
          {application.message && <p><strong>Message:</strong> {application.message}</p>}
        </div>

        <DocumentViewer documents={docs} />

        {application.interview_score && <ScoreChart score={application.interview_score} />}

        {application.status === "pending" && <UnderReviewForm applicationId={application.id} />}
        {application.status === "under_review" && <EligibilityForm applicationId={application.id} />}
        {application.status === "eligible" && <InterviewScheduleForm applicationId={application.id} />}
        {(application.status === "interview_scheduled" || application.status === "scored") && !application.interview_score && (
          <InterviewScoreForm applicationId={application.id} />
        )}
        {application.status === "scored" && (
          <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
            <OfferButton applicationId={application.id} branches={branches} />
          </div>
        )}
        {application.status === "offered" && (
          <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
            <ResendOfferButton applicationId={application.id} />
          </div>
        )}
        {application.status === "accepted" && <CreateLoginForm applicationId={application.id} />}

        {application.timeline && application.timeline.length > 0 && (
          <div className="mt-4 border-t border-surface-100 pt-3 dark:border-surface-800">
            <ApplicationTimeline events={application.timeline} />
          </div>
        )}
      </div>
    </div>
  );
}

function UnderReviewForm({ applicationId }: { applicationId: string }) {
  const [state, formAction] = useFormState(markUnderReview, initialState);
  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      {state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
      <form action={formAction}>
        <input type="hidden" name="application_id" value={applicationId} />
        <button type="submit" className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Review Mein Daalein
        </button>
      </form>
    </div>
  );
}

function EligibilityForm({ applicationId }: { applicationId: string }) {
  const [state, formAction] = useFormState(markEligibility, initialState);
  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Eligibility Decision</p>
      {state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <form action={formAction} className="flex-1">
          <input type="hidden" name="application_id" value={applicationId} />
          <input type="hidden" name="is_eligible" value="true" />
          <button type="submit" className="w-full rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700">
            Shortlist Karein
          </button>
        </form>
        <form action={formAction} className="flex-1">
          <input type="hidden" name="application_id" value={applicationId} />
          <input type="hidden" name="is_eligible" value="false" />
          <button type="submit" className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">
            Reject Karein
          </button>
        </form>
      </div>
    </div>
  );
}

function InterviewScheduleForm({ applicationId }: { applicationId: string }) {
  const [state, formAction] = useFormState(scheduleInterview, initialState);
  const [mode, setMode] = useState<"online" | "face_to_face" | "call">("online");
  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Interview Call Schedule Karein</p>
      {state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="application_id" value={applicationId} />
        <div className="flex gap-2">
          <input type="date" name="interview_date" required className="flex-1 rounded-lg border border-surface-200 p-2 text-sm" />
          <select name="interview_mode" value={mode} onChange={(e) => setMode(e.target.value as any)} className="rounded-lg border border-surface-200 p-2 text-sm">
            <option value="online">Online</option>
            <option value="face_to_face">Face to Face</option>
            <option value="call">Call</option>
          </select>
        </div>
        <input
          name="interview_location"
          placeholder={mode === "online" ? "Meeting Link (Zoom/Google Meet)" : mode === "call" ? "Phone Number" : "Poora Address"}
          className="w-full rounded-lg border border-surface-200 p-2 text-sm"
        />
        <button type="submit" className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">Schedule</button>
      </form>
    </div>
  );
}

function InterviewScoreForm({ applicationId }: { applicationId: string }) {
  const [state, formAction] = useFormState(saveInterviewScore, initialState);
  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-400">
        <Award className="h-3.5 w-3.5" /> Interview Scoring
      </p>
      {state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mb-2 text-xs text-brand-700">Score save ho gaya.</p>}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="application_id" value={applicationId} />
        {DEFAULT_QUESTIONS.map((q, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="hidden" name={`q${i + 1}`} value={q} />
            <p className="flex-1 text-xs text-surface-600 dark:text-surface-300">{q}</p>
            <select name={`s${i + 1}`} defaultValue="5" className="w-16 rounded border border-surface-200 p-1 text-xs">
              {[0, 2, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 border-t border-surface-100 pt-2 dark:border-surface-800">
          <div>
            <label className="text-[10px] text-surface-400">Behavior</label>
            <input type="number" name="behavior_score" defaultValue="5" min="0" max="10" className="w-full rounded border border-surface-200 p-1 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-surface-400">Attitude</label>
            <input type="number" name="attitude_score" defaultValue="5" min="0" max="10" className="w-full rounded border border-surface-200 p-1 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-surface-400">Communication</label>
            <input type="number" name="communication_score" defaultValue="5" min="0" max="10" className="w-full rounded border border-surface-200 p-1 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-surface-400">Cleanliness</label>
            <input type="number" name="cleanliness_score" defaultValue="5" min="0" max="10" className="w-full rounded border border-surface-200 p-1 text-xs" />
          </div>
        </div>
        <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-surface-200 p-2 text-xs" />
        <select name="recommendation" defaultValue="hire" className="w-full rounded-lg border border-surface-200 p-2 text-xs">
          <option value="hire">Hire Karein</option>
          <option value="reject">Reject Karein</option>
        </select>
        <button type="submit" className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">Score Save Karein</button>
      </form>
    </div>
  );
}

function CreateLoginForm({ applicationId }: { applicationId: string }) {
  const [state, formAction] = useFormState(createOfficialLogin, initialState);
  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-400">
        <KeyRound className="h-3.5 w-3.5" /> Official Login Banayein
      </p>
      {state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mb-2 flex items-center gap-1 text-xs text-brand-700"><CheckCircle2 className="h-3 w-3" /> Login ban gaya.</p>}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="application_id" value={applicationId} />
        <input name="official_email" type="email" required placeholder="Official Email (pehle cPanel mein banayein)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <input name="password" type="text" required minLength={6} placeholder="Password (kam az kam 6 characters)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Banaya Ja Raha Hai..." : "Login Banayein"}
    </button>
  );
}