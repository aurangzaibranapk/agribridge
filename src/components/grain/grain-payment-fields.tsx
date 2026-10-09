"use client";
/**
 * Grain payment / wasooli forms ke mushtarka khane: tareekh, account aur
 * raseed (slip). Har staff member ko saaf nazar aaye ke entry KAHAN jayegi:
 * kis tareekh par, kis bank/cash ki cash book mein, aur ledger mein.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Landmark, FileImage, CheckCircle2, AlertTriangle } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/form";
import { aajKaKhana } from "@/lib/utils/format";

function newActionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Purane browser ke liye -- sirf dobara click se bachao ke liye.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function pkDate(value: string): string {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}-${m}-${y}` : value;
}

/**
 * Hidden client_action_id: ek form = ek payment. Dobara "Save" dabane ya
 * internet wapas aane par dobara bhejne se payment do dafa nahi banti.
 */
export function GrainPaymentActionId() {
  const [id, setId] = useState("");
  useEffect(() => setId(newActionId()), []);
  return <input type="hidden" name="client_action_id" value={id} />;
}

export function GrainPaymentDateField({ direction }: { direction: "in" | "out" }) {
  const today = aajKaKhana();
  const [date, setDate] = useState(today);
  const backdated = date !== "" && date < today;
  return (
    <div>
      <Label>
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Payment ki tareekh *</span>
      </Label>
      <Input type="date" name="payment_date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      <p className="mt-1 text-[11px] text-surface-500">
        Jis din paisa {direction === "in" ? "asal mein aaya" : "asal mein diya"} wohi tareekh likhein. Cash book aur ledger dono
        mein yahi tareekh jayegi. Aage ki tareekh nahi chalegi.
      </p>
      {backdated && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="flex items-start gap-1 text-[11px] text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Purani tareekh ({pkDate(date)}): ledger mein &quot;backdated&quot; nishan ke sath darj hogi.
          </p>
          <Input name="backdate_reason" className="mt-1" placeholder="Wajah (optional) — jaise: paisa usi din aaya tha, aaj darj ho raha hai" />
        </div>
      )}
    </div>
  );
}

export function GrainPaymentAccountField({
  accounts,
  direction,
  defaultValue = "",
}: {
  accounts: { id: string; name: string }[];
  direction: "in" | "out";
  defaultValue?: string;
}) {
  const [accountId, setAccountId] = useState(defaultValue);
  const chosen = useMemo(() => accounts.find((a) => a.id === accountId)?.name ?? "", [accounts, accountId]);
  return (
    <div>
      <Label>
        <span className="inline-flex items-center gap-1">
          <Landmark className="h-3.5 w-3.5" />
          {direction === "in" ? "Paisa kis account mein aaya? *" : "Paisa kis account se gaya? *"}
        </span>
      </Label>
      <Select name="account_id" required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value="">— Bank ya Cash chunein —</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </Select>
      <p className="mt-1 text-[11px] text-surface-500">
        {chosen
          ? `Ye raqam "${chosen}" ki cash book aur ledger mein ${direction === "in" ? "jama" : "nikal kar"} darj hogi.`
          : "Naqad haath mein ho to \"Cash in Hand\", bank mein ho to wohi bank (jaise Bank Alfalah) chunein."}
      </p>
    </div>
  );
}

export function GrainPaymentSlipField({ required = false, requiredNote }: { required?: boolean; requiredNote?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <div className={`rounded-lg border p-3 ${required ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20" : "border-surface-200 dark:border-surface-700"}`}>
      <Label>
        <span className="inline-flex items-center gap-1">
          <FileImage className="h-3.5 w-3.5" />
          Raseed / Slip ki photo {required ? "*" : "(optional)"}
        </span>
      </Label>
      <input
        type="file"
        name="receipt_photo"
        accept="image/*,application/pdf"
        required={required}
        className="mt-1 w-full text-xs"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setName(file?.name ?? "");
          setPreview(file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
        }}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Slip" className="mt-2 h-24 rounded-md border border-surface-200 object-cover" />
      )}
      {name && !preview && <p className="mt-1 text-[11px] text-surface-600">{name}</p>}
      <p className="mt-1 text-[11px] text-surface-500">
        {requiredNote ??
          "Bank slip, mobile transfer ka screenshot ya signed raseed ki photo lagayein. Ye bill ki history mein nazar aayegi; na lagayi to \"Slip nahi lagi\" ka nishan lagega."}
      </p>
    </div>
  );
}

export function GrainPaymentSuccess({ notice, fallback }: { notice?: string; fallback: string }) {
  return (
    <div className="mb-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:border-brand-900/50 dark:bg-brand-900/30 dark:text-brand-300">
      <p className="flex items-start gap-1 font-semibold">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {fallback}
      </p>
      {notice && <p className="mt-1">{notice}</p>}
    </div>
  );
}
