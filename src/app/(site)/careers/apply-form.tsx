"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { applyToVacancy, type ActionState } from "@/actions/jobs";
import { CheckCircle2 } from "lucide-react";

const initialState: ActionState = {};

export function ApplyForm({ vacancyId, onClose }: { vacancyId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(applyToVacancy, initialState);

  if (state.success) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">
        <CheckCircle2 className="h-5 w-5 shrink-0" /> Aapki application mil gayi hai. Hum jald aap se rabta karenge.
      </div>
    );
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="mt-3 space-y-2 rounded-lg bg-surface-50 p-3">
      <input type="hidden" name="vacancy_id" value={vacancyId} />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}

      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-surface-400">Basic Information</p>
      <input name="full_name" required placeholder="Full Name" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input type="email" name="email" required placeholder="Email" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input name="phone" placeholder="Phone" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input name="cnic" placeholder="CNIC Number" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input name="address" placeholder="Address" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <input type="number" name="expected_salary" placeholder="Expected Salary (Rs.)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Experience &amp; Qualification</p>
      <textarea name="qualification" rows={2} placeholder="Qualification (e.g. BSc Agriculture, 2022)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <textarea name="experience" rows={2} placeholder="Pichla Kaam / Experience (kahan kaam kiya, kitna arsa)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      <textarea name="message" rows={2} placeholder="Apne baare mein thoda batayein (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Documents</p>
      <div>
        <label className="text-xs text-surface-500">CNIC Front</label>
        <input type="file" name="cnic_front_image" accept="image/*" className="mt-1 w-full text-xs" />
      </div>
      <div>
        <label className="text-xs text-surface-500">CNIC Back</label>
        <input type="file" name="cnic_back_image" accept="image/*" className="mt-1 w-full text-xs" />
      </div>
      <div>
        <label className="text-xs text-surface-500">Qualification Certificate</label>
        <input type="file" name="certificate" accept="image/*,.pdf" className="mt-1 w-full text-xs" />
      </div>
      <div>
        <label className="text-xs text-surface-500">Experience Certificate (agar ho)</label>
        <input type="file" name="experience_certificate" accept="image/*,.pdf" className="mt-1 w-full text-xs" />
      </div>
      <div>
        <label className="text-xs text-surface-500">CV / Resume (agar ho)</label>
        <input type="file" name="cv" accept="image/*,.pdf,.doc,.docx" className="mt-1 w-full text-xs" />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm">Cancel</button>
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Submitting..." : "Apply"}
    </button>
  );
}