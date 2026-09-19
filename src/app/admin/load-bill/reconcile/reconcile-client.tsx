"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { saveLoadReconciliation, type LoadState } from "@/actions/load-bill";

const initial: LoadState = {};

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Darj ho raha hai…" : "Milan darj karein"}
    </Button>
  );
}

interface Hisaab {
  opening: number;
  added: number;
  adjustments: number;
  loadPrincipal: number;
  billPrincipal: number;
  serviceCharge: number;
  expected: number;
  count: number;
  sabootBaqi: number;
}

export function ReconcileClient({
  tareekh,
  aaj,
  accountId,
  accounts,
  hisaab,
  saved,
  canApprove,
}: {
  tareekh: string;
  aaj: string;
  accountId: string;
  accounts: { id: string; label: string }[];
  hisaab: Hisaab;
  saved: { actual: number | null; farq: number | null; reason: string | null; status: string } | null;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [state, action] = useFormState(saveLoadReconciliation, initial);
  const [actual, setActual] = useState(saved?.actual !== null && saved?.actual !== undefined ? String(saved.actual) : "");

  const likhaHua = Number(actual.replace(/,/g, ""));
  const abhiFarq = actual.trim() === "" ? null : Math.round((likhaHua - hisaab.expected) * 100) / 100;

  function jao(next: { tareekh?: string; account?: string }) {
    const p = new URLSearchParams({ tareekh, account: accountId, ...next });
    router.push(`/admin/load-bill/reconcile?${p.toString()}`);
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Label htmlFor="acc">Provider ka account</Label>
          <Select id="acc" value={accountId} onChange={(e) => jao({ account: e.target.value })}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="dt">Tareekh</Label>
          <Input id="dt" type="date" value={tareekh} max={aaj} onChange={(e) => jao({ tareekh: e.target.value })} />
        </div>
      </Card>

      {state.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
          </p>
        </Card>
      )}
      {state.notice && !state.error && (
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/20">
          <p className="flex items-start gap-2 text-sm text-brand-800 dark:text-brand-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.notice}
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* -------- Hisaab kya kehta hai -------- */}
        <Card>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
            <Scale className="h-4 w-4 text-brand-600" /> Hisaab ke mutabiq
          </p>

          <dl className="space-y-2 text-sm">
            <Qatar label="Subah ka float" value={rs(hisaab.opening)} />
            <Qatar label="Din mein float dala" value={hisaab.added ? `+ ${rs(hisaab.added)}` : "—"} />
            {hisaab.adjustments !== 0 && (
              <Qatar
                label="Pichhle milan ka farq"
                value={`${hisaab.adjustments > 0 ? "+" : "−"} ${rs(Math.abs(hisaab.adjustments))}`}
              />
            )}
            <Qatar label="Mobile load" value={hisaab.loadPrincipal ? `− ${rs(hisaab.loadPrincipal)}` : "—"} />
            <Qatar
              label="Bill (jo provider tak pahunch gaye)"
              value={hisaab.billPrincipal ? `− ${rs(hisaab.billPrincipal)}` : "—"}
            />

            <div className="flex items-center justify-between border-t border-surface-200 pt-2 dark:border-surface-700">
              <dt className="text-sm font-semibold text-surface-900 dark:text-white">Float itna hona chahiye</dt>
              <dd className="font-display text-xl font-semibold tabular-nums text-surface-900 dark:text-white">
                {rs(hisaab.expected)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 border-t border-surface-100 pt-3 sm:grid-cols-3 dark:border-surface-800">
            <div>
              <p className="text-xs text-surface-500">Qatarein</p>
              <p className="font-semibold tabular-nums">{hisaab.count}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">Apni aamdani (service charge)</p>
              <p className="font-semibold tabular-nums">{hisaab.serviceCharge ? rs(hisaab.serviceCharge) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">Saboot baqi</p>
              <p className={`font-semibold tabular-nums ${hisaab.sabootBaqi ? "text-amber-700 dark:text-amber-400" : ""}`}>
                {hisaab.sabootBaqi}
              </p>
            </div>
          </div>

          {hisaab.sabootBaqi > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              {hisaab.sabootBaqi} qataron par provider ki TID abhi nahi lagi. Un ka paisa is hisaab mein
              shaamil hai (kaam ho chuka hai), magar saboot na hone se farq nikalne par wajah dhoondhna
              mushkil hoga. Pehle wo TID laga lein.
            </p>
          )}
        </Card>

        {/* -------- Provider ki app kya kehti hai -------- */}
        <Card>
          <p className="mb-1 text-sm font-semibold text-surface-900 dark:text-white">Provider ki app kya kehti hai</p>
          <p className="mb-3 text-[11px] leading-relaxed text-surface-500">
            Provider ki app/portal khol kar us ka asal balance dekhein aur wohi yahan likhein. Khali chhorne
            ka matlab &ldquo;sifar&rdquo; nahi — us ka matlab hai ke abhi dekha hi nahi gaya.
          </p>

          <form action={action} className="space-y-3">
            <input type="hidden" name="account_id" value={accountId} />
            <input type="hidden" name="tareekh" value={tareekh} />

            <div>
              <Label htmlFor="actual_closing">Asal balance</Label>
              <Input
                id="actual_closing"
                name="actual_closing"
                required
                inputMode="decimal"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder={String(hisaab.expected)}
              />
            </div>

            {abhiFarq !== null && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  abhiFarq === 0
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-950/30 dark:text-brand-200"
                    : "bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
                }`}
              >
                {abhiFarq === 0 ? (
                  <p className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Mil gaya — koi farq nahi.
                  </p>
                ) : (
                  <>
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Farq {rs(Math.abs(abhiFarq))} — {abhiFarq < 0 ? "float kam nikla" : "float zyada nikla"}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      Rs 1 ka farq ho sakta hai, magar Rs 1 be-wajah nahi reh sakta.
                    </p>
                  </>
                )}
              </div>
            )}

            {abhiFarq !== null && abhiFarq !== 0 && (
              <div>
                <Label htmlFor="reason">Farq ki wajah</Label>
                <Input
                  id="reason"
                  name="reason"
                  required
                  defaultValue={saved?.reason ?? ""}
                  placeholder="jaise: ek load app se hua, yahan darj nahi hua"
                />
                {!canApprove && (
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                    Farq khate mein daalna Manager/Finance ka kaam hai. Aap ginti likh sakte hain.
                  </p>
                )}
              </div>
            )}

            <Submit />
          </form>

          {saved && (
            <div className="mt-4 border-t border-surface-100 pt-3 text-xs text-surface-500 dark:border-surface-800">
              <p>
                Is din ka milan pehle darj ho chuka hai: asal{" "}
                {saved.actual === null ? "—" : rs(saved.actual)}, farq{" "}
                {saved.farq === null ? "—" : rs(saved.farq)}.
              </p>
              {saved.reason && <p className="mt-0.5">Wajah: {saved.reason}</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Qatar({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-surface-600 dark:text-surface-400">{label}</dt>
      <dd className="tabular-nums text-surface-900 dark:text-white">{value}</dd>
    </div>
  );
}
