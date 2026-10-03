"use client";

import { useFormState, useFormStatus } from "react-dom";
import { reviewOrganizationSignup, type OrganizationSignupState } from "@/actions/organization-signup";

const initialState: OrganizationSignupState = {};

export function SignupRequestActions({ requestId }: { requestId: string }) {
  const [state, action] = useFormState(reviewOrganizationSignup, initialState);
  return <div className="flex items-center gap-2">{state.error && <span className="text-xs text-red-600">{state.error}</span>}{state.success && <span className="text-xs text-emerald-600">Done</span>}<form action={action}><input type="hidden" name="request_id" value={requestId} /><input type="hidden" name="decision" value="approve" /><Submit className="bg-emerald-700" label="Approve" /></form><form action={action}><input type="hidden" name="request_id" value={requestId} /><input type="hidden" name="decision" value="reject" /><Submit className="bg-red-600" label="Reject" /></form></div>;
}

function Submit({ className, label }: { className: string; label: string }) { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${className}`}>{pending ? "..." : label}</button>; }

