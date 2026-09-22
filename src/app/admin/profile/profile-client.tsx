"use client";
import { useFormState, useFormStatus } from "react-dom";
import { changePassword, type ActionState } from "@/actions/my-profile";
import { User, Mail, Shield, Phone, Lock, CheckCircle2 } from "lucide-react";

const KHALI: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-surface-600 dark:bg-surface-900 dark:text-white";
const labelClass = "mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400";

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-100 dark:bg-surface-700">
        <Icon className="h-4 w-4 text-surface-500 dark:text-surface-400" />
      </div>
      <div>
        <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
        <p className="text-sm font-medium text-surface-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function PasswordInput({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type="password" name={name} required className={inputClass} autoComplete="new-password" />
    </div>
  );
}

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      <Lock className="h-4 w-4" />
      {pending ? "Update ho raha hai..." : "Password Update Karein"}
    </button>
  );
}

export function ProfileClient({
  fullName,
  email,
  role,
  phone,
}: {
  fullName: string;
  email: string;
  role: string;
  phone: string;
}) {
  const [state, action] = useFormState(changePassword, KHALI);

  return (
    <div className="space-y-5">
      {/* Info card */}
      <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-800">
        <h2 className="mb-4 text-sm font-semibold text-surface-900 dark:text-white">Profile Info</h2>
        <div className="space-y-4">
          <InfoRow icon={User} label="Naam" value={fullName} />
          <InfoRow icon={Mail} label="Email" value={email} />
          <InfoRow icon={Shield} label="Role" value={role} />
          <InfoRow icon={Phone} label="Phone" value={phone} />
        </div>
      </div>

      {/* Password change */}
      <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-800">
        <h2 className="mb-4 text-sm font-semibold text-surface-900 dark:text-white">Password Badlein</h2>
        <form action={action} className="space-y-3">
          <PasswordInput name="current_password" label="Purana Password" />
          <PasswordInput name="new_password" label="Naya Password (kam az kam 8 harf)" />
          <PasswordInput name="confirm_password" label="Naya Password Dobara Likhein" />
          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {state.message}
            </p>
          )}
          <SubmitBtn />
        </form>
      </div>
    </div>
  );
}
