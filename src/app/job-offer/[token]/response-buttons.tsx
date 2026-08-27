"use client";
import { useState } from "react";
import { respondToOffer } from "@/actions/jobs";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function ResponseButtons({ token }: { token: string }) {
  const [result, setResult] = useState<"accepted" | "rejected" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(accept: boolean) {
    setLoading(true);
    setError(null);
    const res = await respondToOffer(token, accept);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult(accept ? "accepted" : "rejected");
  }

  if (result === "accepted") {
    return (
      <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8" />
        Mubarak ho! Aapko login ke liye email bheja gaya hai - waha se password set karein.
      </div>
    );
  }
  if (result === "rejected") {
    return (
      <div className="rounded-lg bg-surface-50 p-4 text-center text-sm text-surface-600">
        Offer reject kar diya gaya hai. Shukriya.
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => handle(true)}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Accept
        </button>
        <button
          onClick={() => handle(false)}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-surface-300 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-60"
        >
          <XCircle className="h-4 w-4" /> Reject
        </button>
      </div>
    </div>
  );
}