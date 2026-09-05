"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { verifyWorkClaim, verifyFuelClaim, verifyVendorCollection, type ActionState } from "@/actions/machinery-lifecycle";
import { useLang } from "@/lib/i18n/lang-context";
import { t } from "@/lib/i18n/translations";

const initialState: ActionState = {};

interface Claim {
  workId: string;
  /** 'sabit' | 'kutra' | 'dono' -- 'dono' par batwara bhi chahiye. */
  harvestType?: string | null;
  sabit?: number | null;
  kutra?: number | null;
  bookingId: string;
  bookingNumber: string;
  farmerName: string;
  vendorName: string;
  workDate: string;
  area: number;
  isFinal: boolean;
  meterReading: number | null;
  photoUrl: string | null;
  notes: string | null;
  daysOld: number | null;
}

interface FuelClaim {
  fuelId: string;
  bookingId: string;
  bookingNumber: string;
  farmerName: string;
  vendorName: string;
  logDate: string;
  litres: number | null;
  amount: number;
  paidBy: string;
  notes: string | null;
  daysOld: number | null;
}

interface CashClaim {
  paymentId: string;
  bookingId: string;
  bookingNumber: string;
  farmerName: string;
  vendorName: string;
  amount: number;
  paymentDate: string;
  settlement: string | null;
  reference: string | null;
  billBalance: number;
}

export function WorkClaimsClient({
  claims,
  fuelClaims,
  cashClaims,
  accounts,
}: {
  claims: Claim[];
  fuelClaims: FuelClaim[];
  cashClaims: CashClaim[];
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const lang = useLang();

  if (claims.length === 0 && fuelClaims.length === 0 && cashClaims.length === 0) {
    return (
      <p className="rounded-card border border-surface-200 bg-white px-3 py-8 text-center text-surface-400 dark:border-surface-800 dark:bg-surface-900">
        {t("wc_empty", lang)}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {claims.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-surface-700 dark:text-surface-300">
            {t("wc_section_work", lang)}
          </h2>
          {claims.map((c) => (
            <ClaimCard key={c.workId} claim={c} />
          ))}
        </div>
      )}

      {fuelClaims.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-surface-700 dark:text-surface-300">
            {t("wc_section_fuel", lang)}
          </h2>
          {fuelClaims.map((c) => (
            <FuelClaimCard key={c.fuelId} claim={c} accounts={accounts} />
          ))}
        </div>
      )}

      {cashClaims.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-surface-700 dark:text-surface-300">
            {t("wc_section_cash", lang)}
          </h2>
          {cashClaims.map((c) => (
            <CashClaimCard key={c.paymentId} claim={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Vendor ka dawa: "kisan ne mujhe paisa diya."
 *
 * Yahan khata nahi poochha jata, aur ye jaan boojh kar hai: wo paisa
 * hamare kisi khate mein aaya hi nahi. Us ke do hi anjaam hain, aur
 * dono vendor pehle hi bata chuka hai -- ya wo apne hisse mein rakh
 * chuka hai (to us ka baqi utna kam ho gaya), ya wo hamein dega (to
 * wo raqam us ke paas amanat hai).
 *
 * Tasdeeq se pehle ye raqam kahin nahi hai: kisan ka baqi waise ka
 * waisa khara hai. Is liye rad karne ki wajah likhna lazmi hai -- wo
 * vendor ko us ke apne safhe par nazar aati hai.
 */
function CashClaimCard({ claim }: { claim: CashClaim }) {
  const lang = useLang();
  const [state, action] = useFormState(verifyVendorCollection, initialState);
  const [rejecting, setRejecting] = useState(false);

  if (state.success) {
    return (
      <p className="rounded-card border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-200">
        {state.notice}
      </p>
    );
  }

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-surface-900 dark:text-white">{claim.farmerName}</p>
          <p className="text-xs text-surface-500">
            {claim.bookingNumber} · {claim.vendorName} · {new Date(claim.paymentDate).toLocaleDateString()}
            {claim.reference ? ` · ${claim.reference}` : ""}
          </p>
        </div>
        <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">
          Rs {claim.amount.toLocaleString()}
        </p>
      </div>

      <p className="mt-2 rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
        {claim.settlement === "kept" ? t("wc_cash_kept", lang) : t("wc_cash_handed", lang)}
        {claim.billBalance > 0 && ` · ${t("wc_cash_bill_balance", lang)}: Rs ${claim.billBalance.toLocaleString()}`}
      </p>

      {state.error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      )}

      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="payment_id" value={claim.paymentId} />
        {rejecting ? (
          <>
            <input
              name="rejection_reason"
              placeholder={t("wc_reject_reason_hint", lang)}
              className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
            />
            <input type="hidden" name="decision" value="reject" />
            <div className="flex gap-2">
              <Submit label={t("wc_reject", lang)} />
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700"
              >
                {t("ac_cancel", lang)}
              </button>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              type="submit"
              name="decision"
              value="accept"
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("wc_accept", lang)}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 dark:border-surface-700 dark:text-surface-300"
            >
              {t("wc_reject", lang)}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function FuelClaimCard({
  claim,
  accounts,
}: {
  claim: FuelClaim;
  accounts: Array<{ id: string; name: string; account_type: string }>;
}) {
  const lang = useLang();
  const [state, action] = useFormState(verifyFuelClaim, initialState);
  const [mode, setMode] = useState<"" | "accept" | "reject">("");

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/admin/machinery-rental/booking/${claim.bookingId}`}
            className="font-mono text-sm text-brand-600 hover:underline"
          >
            {claim.bookingNumber}
          </Link>
          <p className="font-medium text-surface-900 dark:text-surface-100">{claim.vendorName}</p>
          <p className="text-xs text-surface-500">
            {claim.farmerName} · {new Date(claim.logDate).toLocaleDateString()}
            {claim.litres !== null && ` · ${claim.litres} L`}
          </p>
          <p className="mt-1 text-xs font-medium text-surface-700 dark:text-surface-300">
            {claim.paidBy === "company"
              ? t("mc_diesel_by_company", lang)
              : claim.paidBy === "vendor"
              ? t("mc_diesel_by_vendor", lang)
              : t("mc_diesel_by_farmer", lang)}
          </p>
          {claim.notes && <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">{claim.notes}</p>}
          {claim.daysOld !== null && claim.daysOld > 2 && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {claim.daysOld} {t("ac_days_waiting", lang)}
            </p>
          )}
        </div>
        <p className="whitespace-nowrap font-display text-lg font-semibold text-surface-900 dark:text-white">
          Rs {claim.amount.toLocaleString()}
        </p>
      </div>

      {state.error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 rounded border border-brand-200 bg-brand-50 p-2 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300">
          {t("ac_done", lang)}
        </p>
      )}

      {!state.success && (
        <>
          {mode === "" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setMode("accept")}
                className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                {t("wc_fuel_accept", lang)}
              </button>
              <button
                onClick={() => setMode("reject")}
                className="flex-1 rounded-lg border border-surface-200 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700"
              >
                {t("wc_reject", lang)}
              </button>
            </div>
          )}

          {mode === "accept" && (
            <form action={action} className="mt-3 space-y-2">
              <input type="hidden" name="fuel_id" value={claim.fuelId} />
              <input type="hidden" name="decision" value="accept" />
              {/* Khata sirf ART wale diesel par. Vendor ko ye pata hi
                  nahi hota ke paisa kis khate se nikla -- wo sawal
                  yahin ka hai. */}
              {claim.paidBy === "company" ? (
                <>
                  <label className="block text-xs font-medium text-surface-600">{t("mc_diesel_account", lang)}</label>
                  <select
                    name="finance_account_id"
                    required
                    className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  >
                    <option value="">—</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-surface-500">{t("wc_fuel_accept_hint", lang)}</p>
                </>
              ) : (
                <p className="text-xs text-surface-500">{t("mc_diesel_not_ours", lang)}</p>
              )}
              <div className="flex gap-2">
                <Submit label={t("ac_confirm", lang)} />
                <button type="button" onClick={() => setMode("")} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700">
                  {t("ac_cancel", lang)}
                </button>
              </div>
            </form>
          )}

          {mode === "reject" && (
            <form action={action} className="mt-3 space-y-2">
              <input type="hidden" name="fuel_id" value={claim.fuelId} />
              <input type="hidden" name="decision" value="reject" />
              <input
                name="rejection_reason"
                required
                placeholder={t("wc_reject_reason_hint", lang)}
                className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
              <div className="flex gap-2">
                <Submit label={t("ac_confirm_reject", lang)} />
                <button type="button" onClick={() => setMode("")} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700">
                  {t("ac_cancel", lang)}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function ClaimCard({ claim }: { claim: Claim }) {
  const lang = useLang();
  const [state, action] = useFormState(verifyWorkClaim, initialState);
  const [mode, setMode] = useState<"" | "accept" | "reject">("");

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/admin/machinery-rental/booking/${claim.bookingId}`}
            className="font-mono text-sm text-brand-600 hover:underline"
          >
            {claim.bookingNumber}
          </Link>
          <p className="font-medium text-surface-900 dark:text-surface-100">{claim.vendorName}</p>
          <p className="text-xs text-surface-500">
            {claim.farmerName} · {new Date(claim.workDate).toLocaleDateString()}
            {claim.meterReading !== null && ` · meter ${claim.meterReading}`}
          </p>
          {claim.isFinal && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              {t("wc_marked_final", lang)}
            </p>
          )}
          {claim.notes && <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">{claim.notes}</p>}
          {claim.daysOld !== null && claim.daysOld > 2 && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {claim.daysOld} {t("ac_days_waiting", lang)}
            </p>
          )}
          {claim.photoUrl && (
            <a
              href={claim.photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              {t("wc_view_photo", lang)}
            </a>
          )}
        </div>
        <p className="whitespace-nowrap font-display text-lg font-semibold text-surface-900 dark:text-white">
          {claim.area} acre
        </p>
      </div>

      {state.error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 rounded border border-brand-200 bg-brand-50 p-2 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300">
          {t("ac_done", lang)}
        </p>
      )}

      {!state.success && (
        <>
          {mode === "" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setMode("accept")}
                className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                {t("wc_accept", lang)}
              </button>
              <button
                onClick={() => setMode("reject")}
                className="flex-1 rounded-lg border border-surface-200 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700"
              >
                {t("wc_reject", lang)}
              </button>
            </div>
          )}

          {mode === "accept" && (
            <form action={action} className="mt-3 space-y-2">
              <input type="hidden" name="work_id" value={claim.workId} />
              <input type="hidden" name="decision" value="accept" />
              {/* Naap ka farq theek karna yahin ka kaam hai -- aksar
                  farq neeyat ka nahi, naap ka hota hai. Khali chhor
                  dein to vendor ka adad hi chalta hai. */}
              <p className="text-xs text-surface-500">{t("wc_correct_hint", lang)}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  name="actual_area_acres"
                  placeholder={`${t("wc_acre", lang)} (${claim.area})`}
                  className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
                <input
                  type="number"
                  step="0.01"
                  name="actual_area_kanal"
                  placeholder={t("wc_kanal", lang)}
                  className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
              </div>

              {/* Do qism wali booking par batwara bhi yahin.
                  Sabit aur kutra ka rate ALAG hai -- raqba theek kar ke
                  batwara purana chhor dena bill ko ghalat banata hai.
                  Pehle ye khane the hi nahi, is liye aisi booking par
                  naap theek karne ka koi raasta nahi tha. */}
              {claim.harvestType === "dono" && (
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {t("wc_dono_hint", lang)} — {t("wc_sabit", lang)} {claim.sabit ?? "—"} · {t("wc_kutra", lang)}{" "}
                    {claim.kutra ?? "—"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      name="sabit_area"
                      placeholder={t("wc_sabit", lang)}
                      className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    />
                    <input
                      type="number"
                      step="0.01"
                      name="kutra_area"
                      placeholder={t("wc_kutra", lang)}
                      className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Submit label={t("ac_confirm", lang)} />
                <button type="button" onClick={() => setMode("")} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700">
                  {t("ac_cancel", lang)}
                </button>
              </div>
            </form>
          )}

          {mode === "reject" && (
            <form action={action} className="mt-3 space-y-2">
              <input type="hidden" name="work_id" value={claim.workId} />
              <input type="hidden" name="decision" value="reject" />
              <input
                name="rejection_reason"
                required
                placeholder={t("wc_reject_reason_hint", lang)}
                className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
              <div className="flex gap-2">
                <Submit label={t("ac_confirm_reject", lang)} />
                <button type="button" onClick={() => setMode("")} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500 dark:border-surface-700">
                  {t("ac_cancel", lang)}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "..." : label}
    </button>
  );
}
