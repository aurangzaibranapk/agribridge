"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveLandlordSignature, type ActionState } from "@/actions/shop-rent";
import { SignaturePad } from "@/components/ui/signature-pad";

const initialState: ActionState = {};

export function SignSection({ token }: { token: string }) {
  const [state, formAction] = useFormState(saveLandlordSignature, initialState);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  if (state.success) {
    return (
      <p className="rounded-lg bg-green-50 p-4 text-center text-green-700" dir="rtl">
        شکریہ! آپ کے دستخط محفوظ کر لیے گئے ہیں۔
      </p>
    );
  }

  return (
    <div dir="rtl" className="rounded-card bg-white p-5 shadow-card">
      <h3 className="mb-3 text-lg font-bold text-surface-900">دستخط کریں</h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="signature_data" value={signatureData ?? ""} />
        <SignaturePad onChange={setSignatureData} />
        <label className="mt-3 flex items-center gap-2 text-sm text-surface-700">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          میں نے مندرجہ بالا شرائط پڑھ لی ہیں اور اس سے متفق ہوں۔
        </label>
        <SubmitButton disabled={!signatureData || !agreed} />
      </form>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="mt-3 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40">
      {pending ? "محفوظ ہو رہا ہے..." : "دستخط جمع کروائیں"}
    </button>
  );
}