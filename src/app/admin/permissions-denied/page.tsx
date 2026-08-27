import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default function PermissionsDeniedPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <ShieldAlert className="h-12 w-12 text-amber-500" />
      <h1 className="mt-4 font-display text-xl font-semibold text-surface-900">Abhi Koi Access Nahi Diya Gaya</h1>
      <p className="mt-2 text-sm text-surface-500">
        Aap ka account bana hua hai, lekin abhi tak admin ne aapko koi page dekhne ki ijazat nahi di. Barah-e-meherbani apne admin se rabta karein.
      </p>
    </div>
  );
}